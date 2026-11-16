import { sql } from "@/db/pool";
import { guard, ok, staffCampaignIds } from "@/lib/portal/guard";
import { can } from "@/lib/portal/session";

// GET /api/admin/nav-counts — numbers for the menu badges and the "needs attention" list,
// only for what this person may act on.
export async function GET() {
  const g = await guard({ staff: true });
  if ("error" in g) return g.error;
  const { me } = g;
  const scope = await staffCampaignIds(me);
  const out: Record<string, number> = {};

  if (can(me, "accounts.verify")) {
    const [r] = await sql<{ pending: number; needs_code: number }>(
      `select count(*) filter (where status = 'pending')::int as pending,
              count(*) filter (where status = 'pending' and verify_code = '')::int as needs_code
         from social_accounts`,
    );
    out.pendingAccounts = r.pending;
    out.accountsNeedingCode = r.needs_code;
  }
  if (can(me, "submissions.review")) {
    const [r] =
      scope === null
        ? await sql<{ n: number }>("select count(*)::int as n from submissions where status = 'pending'")
        : scope.length
          ? await sql<{ n: number }>("select count(*)::int as n from submissions where status = 'pending' and campaign_id = any($1)", [scope])
          : [{ n: 0 }];
    out.pendingSubmissions = r.n;
  }
  return ok(out);
}
