import { sql } from "@/db/pool";
import { guard, ok, staffCampaignIds } from "@/lib/portal/guard";

const LIMIT = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/admin/submissions?status=pending|approved|rejected|all&campaign=&clipper=&q= — the review queue,
// limited to campaigns this person works on (super admin = all).
export async function GET(req: Request) {
  const g = await guard({ permission: "submissions.review" });
  if ("error" in g) return g.error;
  const url = new URL(req.url);
  const status = ["pending", "approved", "rejected", "all"].includes(url.searchParams.get("status") ?? "") ? url.searchParams.get("status")! : "pending";
  const campaign = url.searchParams.get("campaign") ?? "";
  const clipper = url.searchParams.get("clipper") ?? "";
  // escape LIKE wildcards (%, _, \) so a handle like e2e_test_acc1 is matched literally
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 60).replace(/[\\%_]/g, (m) => "\\" + m);

  const scope = await staffCampaignIds(g.me); // null = all
  const empty = { rows: [], counts: { pending: 0, approved: 0, rejected: 0 }, campaigns: [], truncated: false };
  if (scope !== null && scope.length === 0) return ok(empty);

  const params: unknown[] = [];
  const base: string[] = [];
  if (scope) base.push(`s.campaign_id = any($${params.push(scope)})`);

  const where = [...base];
  if (status !== "all") where.push(`s.status = $${params.push(status)}`);
  if (UUID.test(campaign)) where.push(`s.campaign_id = $${params.push(campaign)}`);
  if (UUID.test(clipper)) where.push(`s.clipper_id = $${params.push(clipper)}`);
  if (q) {
    const i = params.push(`%${q}%`);
    where.push(`(s.url ilike $${i} or a.username ilike $${i} or p.full_name ilike $${i} or p.login_id ilike $${i})`);
  }

  const [rows, counts, campaigns] = await Promise.all([
    sql(
      `select s.id, s.url, s.note, s.status, s.created_at, s.reviewed_at, s.reject_reason,
              s.campaign_id, c.name as campaign_name, s.clipper_id, p.full_name as clipper_name, p.login_id as clipper_login,
              a.platform, a.username, rv.full_name as reviewer_name
         from submissions s
         join campaigns c on c.id = s.campaign_id
         join profiles p on p.id = s.clipper_id
         join social_accounts a on a.id = s.account_id
         left join profiles rv on rv.id = s.reviewed_by
        ${where.length ? "where " + where.join(" and ") : ""}
        order by s.created_at ${status === "pending" ? "asc" : "desc"}
        limit ${LIMIT}`,
      params,
    ),
    sql<{ status: string; n: number }>(
      `select s.status, count(*)::int as n from submissions s ${scope ? "where s.campaign_id = any($1)" : ""} group by s.status`,
      scope ? [scope] : [],
    ),
    sql<{ id: string; name: string }>(
      `select c.id, c.name from campaigns c ${scope ? "where c.id = any($1)" : ""} order by c.created_at desc`,
      scope ? [scope] : [],
    ),
  ]);

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c.n]));
  return ok({
    rows,
    counts: { pending: byStatus.pending ?? 0, approved: byStatus.approved ?? 0, rejected: byStatus.rejected ?? 0 },
    campaigns,
    truncated: rows.length >= LIMIT,
  });
}
