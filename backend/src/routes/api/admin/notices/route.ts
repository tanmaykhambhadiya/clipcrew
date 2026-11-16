import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sql } from "@/db/pool";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fail, guard, ok, parseBody, staffCampaignIds } from "@/lib/portal/guard";
import { audit } from "@/lib/portal/session";
import { httpUrl } from "@/loaders/rejections";

const MAX_RECIPIENTS = 5000;

const sendSchema = z.object({
  audience: z.discriminatedUnion("type", [
    z.object({ type: z.literal("everyone") }),
    z.object({ type: z.literal("campaigns"), campaignIds: z.array(z.uuid()).min(1, "Pick at least one campaign.").max(50) }),
    z.object({ type: z.literal("clippers"), clipperIds: z.array(z.uuid()).min(1, "Pick at least one clipper.").max(500) }),
  ]),
  title: z.string().trim().min(2, "Add a title.").max(120, "Keep the title under 120 characters."),
  body: z.string().trim().min(2, "Write the message.").max(2000, "Keep it under 2000 characters."),
  link: z.union([httpUrl, z.literal("")]).optional().nullable(),
});

// POST /api/admin/notices — send a notice to everyone, to campaigns, or to chosen clippers.
// One send = one batch_id, so the history can show how many people got it and how many read it.
//  - everyone: super admin only
//  - campaigns: campaigns.manage + access to each campaign
//  - clippers: campaigns.manage; staff may only pick clippers who are in campaigns they work on
export async function POST(req: Request) {
  const g = await guard({ permission: "campaigns.manage" });
  if ("error" in g) return g.error;
  const { me } = g;
  const body = await parseBody(req, sendSchema);
  if ("error" in body) return body.error;
  const d = body.data;
  const scope = await staffCampaignIds(me); // null = all campaigns (super admin)

  let recipients: string[] = [];
  let campaignId: string | null = null;

  if (d.audience.type === "everyone") {
    if (me.role !== "super_admin") return fail(403, "Only the super admin can send to everyone.");
    recipients = (await sql<{ id: string }>("select id from profiles where role = 'clipper' and status = 'active'")).map((r) => r.id);
  } else if (d.audience.type === "campaigns") {
    const ids = Array.from(new Set(d.audience.campaignIds));
    if (scope && ids.some((id) => !scope.includes(id))) return fail(403, "You're not assigned to one of those campaigns.");
    recipients = (
      await sql<{ id: string }>(
        `select distinct p.id from campaign_clippers cc join profiles p on p.id = cc.clipper_id
          where cc.campaign_id = any($1) and p.role = 'clipper' and p.status = 'active'`,
        [ids],
      )
    ).map((r) => r.id);
    if (ids.length === 1) campaignId = ids[0];
  } else {
    const ids = Array.from(new Set(d.audience.clipperIds));
    const rows = scope
      ? await sql<{ id: string }>(
          `select distinct p.id from profiles p join campaign_clippers cc on cc.clipper_id = p.id
            where p.id = any($1) and cc.campaign_id = any($2) and p.role = 'clipper' and p.status = 'active'`,
          [ids, scope.length ? scope : [randomUUID()]],
        )
      : await sql<{ id: string }>("select id from profiles where id = any($1) and role = 'clipper' and status = 'active'", [ids]);
    recipients = rows.map((r) => r.id);
    if (recipients.length !== ids.length) return fail(400, "Some of those clippers aren't active or aren't in your campaigns.");
  }

  if (!recipients.length) return fail(400, "There's nobody to send this to yet.");
  if (recipients.length > MAX_RECIPIENTS) return fail(400, `That's more than ${MAX_RECIPIENTS} people — pick a smaller audience.`);

  const batchId = randomUUID();
  const { error } = await getSupabaseAdmin()
    .from("notifications")
    .insert(
      recipients.map((id) => ({
        clipper_id: id,
        kind: "info",
        title: d.title,
        body: d.body,
        reel_ref: d.link || null, // the only link column on notifications; the inbox shows it as "Link"
        campaign_id: campaignId,
        created_by: me.id,
        batch_id: batchId,
      })),
    );
  if (error) {
    console.error("[notices] insert failed", error);
    return fail(500, "Couldn't send the notice. Nothing was sent.");
  }

  await audit(me.id, "NOTICE_SENT", "notice", batchId, null, { audience: d.audience.type, title: d.title, recipients: recipients.length });
  return ok({ batchId, recipients: recipients.length });
}

// GET /api/admin/notices — recent notices with how many people got and read each. Staff see their own sends; super admin sees all.
export async function GET() {
  const g = await guard({ permission: "campaigns.manage" });
  if ("error" in g) return g.error;
  const { me } = g;
  const params: unknown[] = [];
  const who = me.role === "super_admin" ? "" : `and n.created_by = $${params.push(me.id)}`;

  const rows = await sql(
    `select n.batch_id, min(n.title) as title, min(n.body) as body, min(n.reel_ref) as link, min(n.created_at) as sent_at,
            min(p.full_name) as sender, min(c.name) as campaign_name,
            count(*)::int as recipients, count(n.read_at)::int as read_count
       from notifications n
       left join profiles p on p.id = n.created_by
       left join campaigns c on c.id = n.campaign_id
      where n.batch_id is not null ${who}
      group by n.batch_id
      order by min(n.created_at) desc
      limit 50`,
    params,
  );
  const [{ total }] = await sql<{ total: number }>("select count(*)::int as total from profiles where role = 'clipper' and status = 'active'");
  return ok({
    notices: rows.map((r: any) => ({
      ...r,
      audience: r.campaign_name ?? (r.recipients >= total ? "Everyone" : `${r.recipients} selected clipper${r.recipients === 1 ? "" : "s"}`),
    })),
  });
}
