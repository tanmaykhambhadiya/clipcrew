import { sql, sqlOne } from "@/db/pool";
import { fail, guard, ok, staffCampaignIds } from "@/lib/portal/guard";
import { can } from "@/lib/portal/session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/pages/admin/clippers/:id — everything about one clipper on one screen.
// Staff may open a clipper only if they share a campaign; super admin can open anyone.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await guard({ permission: "users.create" });
  if ("error" in g) return g.error;
  const { me } = g;
  if (!UUID.test(params.id)) return fail(404, "Clipper not found.");
  const id = params.id;

  const profile = await sqlOne(
    `select id, login_id, full_name, status, phone, upi_id, created_at, terminated_at, termination_reason
       from profiles where id = $1 and role = 'clipper'`,
    [id],
  );
  if (!profile) return fail(404, "Clipper not found.");

  const scope = await staffCampaignIds(me);
  if (scope) {
    const shared = scope.length
      ? await sqlOne("select 1 as x from campaign_clippers where clipper_id = $1 and campaign_id = any($2) limit 1", [id, scope])
      : null;
    if (!shared) return fail(403, "This clipper isn't in any of your campaigns.");
  }
  const scopeArr = scope ?? null;

  const [accounts, campaigns, submissions, weekly, fines, payouts, notices, activity, balance] = await Promise.all([
    sql(
      `select a.id, a.platform, a.username, a.status, a.verify_code, a.created_at, a.verified_at,
              coalesce((select array_agg(c.name order by c.name) from campaign_accounts ca join campaigns c on c.id = ca.campaign_id where ca.account_id = a.id), '{}') as campaigns
         from social_accounts a where a.clipper_id = $1 order by a.created_at desc`,
      [id],
    ),
    sql(
      `select c.id, c.name, c.status, cc.joined_at,
              coalesce((select sum(w.views) from weekly_views w join social_accounts a on a.id = w.account_id where w.campaign_id = c.id and a.clipper_id = $1), 0)::bigint as views,
              coalesce((select sum(w.amount_paise) from weekly_views w join social_accounts a on a.id = w.account_id where w.campaign_id = c.id and a.clipper_id = $1), 0)::bigint as earned_paise
         from campaign_clippers cc join campaigns c on c.id = cc.campaign_id
        where cc.clipper_id = $1 ${scopeArr ? "and c.id = any($2)" : ""}
        order by cc.joined_at desc`,
      scopeArr ? [id, scopeArr] : [id],
    ),
    sql(
      `select s.id, s.url, s.status, s.created_at, s.reject_reason, c.name as campaign_name, a.platform, a.username
         from submissions s join campaigns c on c.id = s.campaign_id join social_accounts a on a.id = s.account_id
        where s.clipper_id = $1 ${scopeArr ? "and s.campaign_id = any($2)" : ""}
        order by s.created_at desc limit 20`,
      scopeArr ? [id, scopeArr] : [id],
    ),
    sql(
      `select w.week_start, sum(w.views)::bigint as views, sum(w.amount_paise)::bigint as amount_paise
         from weekly_views w join social_accounts a on a.id = w.account_id
        where a.clipper_id = $1 ${scopeArr ? "and w.campaign_id = any($2)" : ""}
        group by w.week_start order by w.week_start desc limit 12`,
      scopeArr ? [id, scopeArr] : [id],
    ),
    sql(
      `select f.id, f.amount_paise, f.reason, f.reel_ref, f.created_at, f.waived_at, c.name as campaign_name
         from fines f left join campaigns c on c.id = f.campaign_id
        where f.clipper_id = $1 order by f.created_at desc limit 20`,
      [id],
    ),
    sql("select id, amount_paise, paid_on, reference, note from payouts where clipper_id = $1 order by paid_on desc, created_at desc limit 20", [id]),
    sql(
      `select id, kind, title, created_at, read_at from notifications where clipper_id = $1 order by created_at desc limit 15`,
      [id],
    ),
    can(me, "audit.view")
      ? sql(
          `select l.id, l.action, l.created_at, p.full_name as actor_name
             from audit_log l left join profiles p on p.id = l.actor_id
            where l.entity_id = $1 or l.actor_id = $1 order by l.created_at desc limit 15`,
          [id],
        )
      : Promise.resolve([]),
    sqlOne(
      "select earned_paise::bigint as earned_paise, fines_paise::bigint as fines_paise, paid_paise::bigint as paid_paise from clipper_balances where clipper_id = $1",
      [id],
    ),
  ]);

  return ok({
    profile,
    accounts,
    campaigns,
    submissions,
    weekly,
    fines,
    payouts,
    notices,
    activity,
    balance: balance ?? { earned_paise: 0, fines_paise: 0, paid_paise: 0 },
    can: {
      resetPassword: true,
      terminate: me.role === "super_admin",
      editProfile: true,
      payouts: can(me, "payouts.manage"),
      notices: can(me, "campaigns.manage"),
      verifyAccounts: can(me, "accounts.verify"),
      reviewSubmissions: can(me, "submissions.review"),
    },
  });
}
