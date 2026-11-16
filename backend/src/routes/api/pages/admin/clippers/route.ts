import { sql } from "@/db/pool";
import { guard, ok, staffCampaignIds } from "@/lib/portal/guard";

const LIMIT = 300;

// GET /api/pages/admin/clippers?q=&status= — every clipper with account, campaign, submission and balance
// summaries. Staff see only clippers who are in campaigns they work on; super admin sees everyone.
export async function GET(req: Request) {
  const g = await guard({ permission: "users.create" });
  if ("error" in g) return g.error;
  const url = new URL(req.url);
  // escape LIKE wildcards (%, _, \) so a handle like e2e_test_acc1 is matched literally
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 60).replace(/[\\%_]/g, (m) => "\\" + m);
  const status = ["active", "terminated"].includes(url.searchParams.get("status") ?? "") ? url.searchParams.get("status")! : "";

  const scope = await staffCampaignIds(g.me);
  if (scope !== null && scope.length === 0) return ok({ clippers: [], truncated: false, scoped: true });

  const params: unknown[] = [];
  const where = ["p.role = 'clipper'"];
  if (scope) where.push(`exists (select 1 from campaign_clippers x where x.clipper_id = p.id and x.campaign_id = any($${params.push(scope)}))`);
  if (status) where.push(`p.status = $${params.push(status)}`);
  if (q) {
    const i = params.push(`%${q}%`);
    where.push(`(p.full_name ilike $${i} or p.login_id ilike $${i} or p.upi_id ilike $${i} or p.phone ilike $${i})`);
  }

  const clippers = await sql(
    `select p.id, p.full_name, p.login_id, p.status, p.phone, p.upi_id, p.created_at,
            (select count(*)::int from social_accounts a where a.clipper_id = p.id and a.status = 'verified') as accounts_verified,
            (select count(*)::int from social_accounts a where a.clipper_id = p.id and a.status = 'pending') as accounts_pending,
            (select count(*)::int from campaign_clippers cc where cc.clipper_id = p.id) as campaigns,
            (select count(*)::int from submissions s where s.clipper_id = p.id and s.status = 'pending') as submissions_pending,
            coalesce(b.earned_paise - b.fines_paise - b.paid_paise, 0)::bigint as balance_paise,
            (select max(l.created_at) from audit_log l where l.actor_id = p.id and l.action = 'LOGIN') as last_login
       from profiles p
       left join clipper_balances b on b.clipper_id = p.id
      where ${where.join(" and ")}
      order by p.status asc, p.full_name asc
      limit ${LIMIT}`,
    params,
  );
  return ok({ clippers, truncated: clippers.length >= LIMIT, scoped: scope !== null });
}
