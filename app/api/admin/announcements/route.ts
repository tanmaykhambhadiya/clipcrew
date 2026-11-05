import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { canAccessCampaign, fail, guard, ok, parseBody } from "@/lib/portal/guard";
import { audit } from "@/lib/portal/session";
import { getCampaign, httpUrl } from "@/app/admin/rejections/server";

const schema = z.object({
  campaignId: z.uuid("Pick a campaign"),
  clipperId: z.uuid("Pick a clipper").optional().nullable(), // empty → every clipper in the campaign
  title: z.string().trim().min(2, "Add a title").max(120, "Keep the title under 120 characters"),
  body: z.string().trim().min(2, "Write the message").max(2000, "Keep it under 2000 characters"),
  link: z.union([httpUrl, z.literal("")]).optional().nullable(),
});

// POST /api/admin/announcements — share news / a brief with all clippers of a campaign, or with one.
export async function POST(req: Request) {
  const g = await guard({ permission: "campaigns.manage" });
  if ("error" in g) return g.error;
  const { me } = g;
  const p = await parseBody(req, schema);
  if ("error" in p) return p.error;
  const d = p.data;

  if (!(await canAccessCampaign(me, d.campaignId))) return fail(403, "You're not assigned to that campaign.");
  const campaign = await getCampaign(d.campaignId);
  if (!campaign) return fail(404, "That campaign no longer exists.");

  const sb = getSupabaseAdmin();
  const { data: memberRows } = await sb
    .from("campaign_clippers")
    .select("clipper_id")
    .eq("campaign_id", d.campaignId)
    .limit(10000);
  let recipientIds = ((memberRows ?? []) as { clipper_id: string }[]).map((r) => r.clipper_id);
  if (d.clipperId) {
    if (!recipientIds.includes(d.clipperId))
      return fail(400, "That clipper isn't in this campaign.", { clipperId: "Not in this campaign" });
    recipientIds = [d.clipperId];
  }
  if (recipientIds.length) {
    const { data: active } = await sb
      .from("profiles")
      .select("id")
      .in("id", recipientIds)
      .eq("role", "clipper")
      .eq("status", "active");
    recipientIds = ((active ?? []) as { id: string }[]).map((r) => r.id);
  }
  if (!recipientIds.length)
    return fail(400, d.clipperId ? "That clipper isn't active." : "This campaign has no active clippers yet.");

  // One insert → every row shares the same created_at, which is how the history groups them.
  const { error } = await sb.from("notifications").insert(
    recipientIds.map((id) => ({
      clipper_id: id,
      kind: "info",
      title: d.title,
      body: d.body,
      reel_ref: d.link || null, // the only link column on notifications; the inbox shows it as "Link"
      campaign_id: d.campaignId,
      created_by: me.id,
    })),
  );
  if (error) {
    console.error("[announcements] insert failed", error);
    return fail(500, "Couldn't send the announcement.");
  }

  await audit(me.id, "ANNOUNCEMENT_SENT", "campaign", d.campaignId, null, {
    title: d.title,
    body: d.body,
    link: d.link || null,
    clipperId: d.clipperId ?? null,
    recipients: recipientIds.length,
  });
  return ok({ recipients: recipientIds.length });
}
