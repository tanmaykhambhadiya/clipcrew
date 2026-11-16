import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sql } from "@/db/pool";
import { fail, guard, ok, parseBody } from "@/lib/portal/guard";
import { checkReelUrl } from "@/lib/portal/reelUrl";
import { findPriorRejection, fmtDate } from "@/loaders/reelStatus";

const DAILY_LIMIT = 100;

const createSchema = z.object({
  campaignId: z.uuid("Pick a campaign."),
  accountId: z.uuid("Pick the account you posted from."),
  url: z.string().trim().min(1, "Paste the link to your reel.").max(500, "That link is too long."),
  note: z.string().trim().max(300, "Keep the note under 300 characters.").optional(),
});

type Row = {
  id: string; url: string; note: string | null; status: string; reject_reason: string | null; created_at: string; reviewed_at: string | null;
  campaign_id: string; campaign_name: string; platform: string; username: string;
};

// GET /api/portal/submissions?campaign=&status= — the signed-in clipper's submitted reels, plus what the form needs:
// campaigns they're in (active) and which of their verified accounts count in each.
export async function GET(req: Request) {
  const g = await guard({ clipper: true });
  if ("error" in g) return g.error;
  const me = g.me;
  const url = new URL(req.url);
  const campaign = url.searchParams.get("campaign") ?? "";
  const status = url.searchParams.get("status") ?? "";

  const params: unknown[] = [me.id];
  const where = ["s.clipper_id = $1"];
  if (/^[0-9a-f-]{36}$/i.test(campaign)) where.push(`s.campaign_id = $${params.push(campaign)}`);
  if (["pending", "approved", "rejected"].includes(status)) where.push(`s.status = $${params.push(status)}`);

  const [submissions, options] = await Promise.all([
    sql<Row>(
      `select s.id, s.url, s.note, s.status, s.reject_reason, s.created_at, s.reviewed_at, s.campaign_id,
              c.name as campaign_name, a.platform, a.username
         from submissions s
         join campaigns c on c.id = s.campaign_id
         join social_accounts a on a.id = s.account_id
        where ${where.join(" and ")}
        order by s.created_at desc limit 200`,
      params,
    ),
    sql<{ campaign_id: string; campaign_name: string; account_id: string; platform: string; username: string }>(
      `select c.id as campaign_id, c.name as campaign_name, a.id as account_id, a.platform, a.username
         from campaign_clippers cc
         join campaigns c on c.id = cc.campaign_id and c.status = 'active'
         join campaign_accounts ca on ca.campaign_id = c.id
         join social_accounts a on a.id = ca.account_id and a.clipper_id = $1 and a.status = 'verified'
        where cc.clipper_id = $1
        order by c.name, a.username`,
      [me.id],
    ),
  ]);

  const byCampaign = new Map<string, { id: string; name: string; accounts: { id: string; platform: string; username: string }[] }>();
  for (const o of options) {
    const c = byCampaign.get(o.campaign_id) ?? { id: o.campaign_id, name: o.campaign_name, accounts: [] };
    c.accounts.push({ id: o.account_id, platform: o.platform, username: o.username });
    byCampaign.set(o.campaign_id, c);
  }
  return ok({ submissions, options: Array.from(byCampaign.values()) });
}

// POST /api/portal/submissions — submit a reel link. Only for the clipper's own verified account that counts
// in an active campaign they belong to, on a link that matches the account's platform.
export async function POST(req: Request) {
  const g = await guard({ clipper: true });
  if ("error" in g) return g.error;
  const me = g.me;
  const body = await parseBody(req, createSchema);
  if ("error" in body) return body.error;
  const d = body.data;

  const eligible = await sql<{ platform: string; username: string }>(
    `select a.platform, a.username
       from campaign_clippers cc
       join campaigns c on c.id = cc.campaign_id and c.status = 'active'
       join campaign_accounts ca on ca.campaign_id = c.id and ca.account_id = $3
       join social_accounts a on a.id = ca.account_id and a.clipper_id = $1 and a.status = 'verified'
      where cc.clipper_id = $1 and cc.campaign_id = $2`,
    [me.id, d.campaignId, d.accountId],
  );
  if (!eligible[0]) {
    return fail(400, "That account isn't verified and linked to this active campaign. Check the Campaigns page.", { accountId: "Not available for this campaign" });
  }

  const check = checkReelUrl(d.url, eligible[0].platform);
  if (!check.ok) return fail(400, check.error, { url: check.error });

  // Rejected from "Rejections & fines" before it was ever submitted? Then it can't be submitted now.
  const rejected = await findPriorRejection(me.id, check.key);
  if (rejected) {
    const msg = `This reel was rejected on ${fmtDate(rejected.createdAt)} — check your inbox. Rejected reels can't be submitted.`;
    return fail(409, msg, { url: "Already rejected" });
  }

  const [{ n }] = await sql<{ n: number }>("select count(*)::int as n from submissions where clipper_id = $1 and created_at > now() - interval '24 hours'", [me.id]);
  if (n >= DAILY_LIMIT) return fail(429, `You've reached today's limit of ${DAILY_LIMIT} submissions. Try again tomorrow.`);

  const { data, error } = await getSupabaseAdmin()
    .from("submissions")
    .insert({ clipper_id: me.id, campaign_id: d.campaignId, account_id: d.accountId, url: check.url, url_key: check.key, note: d.note || null })
    .select("id, status, created_at")
    .single();
  if (error || !data) {
    if (error?.code === "23505") return fail(409, "That reel has already been submitted.", { url: "Already submitted" });
    console.error("[submissions] insert failed", error);
    return fail(500, "Couldn't save your submission. Please try again.");
  }
  return ok({ submission: data });
}
