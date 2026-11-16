import { getSupabaseAdmin } from "@/lib/supabase";
import { canAccessCampaign, fail, guard, ok } from "@/lib/portal/guard";
import { can } from "@/lib/portal/session";
import { addDays, currentWeekStart } from "@/lib/portal/weeks";
import { CAMPAIGN_COLUMNS, fetchAll, fetchIn, weeklyViewsFor, type CampaignRow } from "@/loaders/campaignData";

type Account = { id: string; clipper_id: string; platform: string; username: string; status: "pending" | "verified" | "rejected" };
type Person = { id: string; login_id: string; full_name: string; status?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/pages/admin/campaigns/:id — everything the campaign detail screen shows.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await guard({ staff: true });
  if ("error" in g) return g.error;
  const { me } = g;
  if (!UUID.test(params.id)) return fail(404, "Campaign not found.");
  if (!(await canAccessCampaign(me, params.id))) return ok({ denied: true });

  const db = getSupabaseAdmin();
  const { data: campaignData } = await db.from("campaigns").select(CAMPAIGN_COLUMNS).eq("id", params.id).maybeSingle();
  if (!campaignData) return fail(404, "Campaign not found.");
  const c = campaignData as CampaignRow;
  const isSuper = me.role === "super_admin";

  const [members, links, views, staffRows] = await Promise.all([
    fetchAll<{ clipper_id: string; joined_at: string }>((from, to) =>
      db.from("campaign_clippers").select("clipper_id, joined_at").eq("campaign_id", c.id).order("joined_at").range(from, to),
    ),
    fetchAll<{ account_id: string }>((from, to) =>
      db.from("campaign_accounts").select("account_id").eq("campaign_id", c.id).order("account_id").range(from, to),
    ),
    weeklyViewsFor([c.id]),
    db.from("campaign_staff").select("staff_id").eq("campaign_id", c.id),
  ]);

  const linkedIds = new Set(links.map((l) => l.account_id));
  const accounts = await fetchIn<Account>(
    [...Array.from(linkedIds), ...views.map((v) => v.account_id)],
    (chunk, from, to) => db.from("social_accounts").select("id, clipper_id, platform, username, status").in("id", chunk).order("id").range(from, to),
  );
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const memberIds = new Set(members.map((m) => m.clipper_id));
  const viewClipperIds = views.map((v) => accountById.get(v.account_id)?.clipper_id).filter((x): x is string => !!x);
  const people = await fetchIn<Person>([...Array.from(memberIds), ...viewClipperIds], (chunk, from, to) =>
    db.from("profiles").select("id, login_id, full_name, status").in("id", chunk).order("id").range(from, to),
  );
  const personById = new Map(people.map((p) => [p.id, p]));

  // ---- stats
  const thisWeek = currentWeekStart();
  const lastWeek = addDays(thisWeek, -7);
  let totalViews = 0, totalEarned = 0, thisWeekViews = 0, lastWeekViews = 0;
  const perClipper = new Map<string, { views: number; earned: number }>();
  for (const v of views) {
    totalViews += Number(v.views);
    totalEarned += Number(v.amount_paise);
    if (v.week_start === thisWeek) thisWeekViews += Number(v.views);
    if (v.week_start === lastWeek) lastWeekViews += Number(v.views);
    const owner = accountById.get(v.account_id)?.clipper_id;
    if (!owner) continue;
    const t = perClipper.get(owner) ?? { views: 0, earned: 0 };
    t.views += Number(v.views);
    t.earned += Number(v.amount_paise);
    perClipper.set(owner, t);
  }
  const delta = lastWeekViews > 0 ? Math.round(((thisWeekViews - lastWeekViews) / lastWeekViews) * 100) : null;

  // ---- clipper rows: current members first, then people removed who still have views here
  const linkedByClipper = new Map<string, Account[]>();
  for (const id of Array.from(linkedIds)) {
    const a = accountById.get(id);
    if (!a) continue;
    linkedByClipper.set(a.clipper_id, [...(linkedByClipper.get(a.clipper_id) ?? []), a]);
  }
  const rows = [
    ...members.map((m) => ({ id: m.clipper_id, joinedAt: m.joined_at as string | null, current: true })),
    ...Array.from(perClipper.keys())
      .filter((id) => !memberIds.has(id))
      .map((id) => ({ id, joinedAt: null as string | null, current: false })),
  ].map((r) => ({ ...r, person: personById.get(r.id) ?? null, accounts: linkedByClipper.get(r.id) ?? [], totals: perClipper.get(r.id) ?? { views: 0, earned: 0 } }));

  // ---- staff
  const assignedStaffIds = (staffRows.data ?? []).map((s: any) => s.staff_id as string);
  let assignedStaff: Person[] = [];
  let availableStaff: Person[] = [];
  if (isSuper) {
    const { data } = await db.from("profiles").select("id, login_id, full_name, status").eq("role", "admin").order("full_name");
    const all = (data ?? []) as Person[];
    assignedStaff = all.filter((s) => assignedStaffIds.includes(s.id));
    availableStaff = all.filter((s) => s.status === "active");
  } else if (assignedStaffIds.length) {
    const { data } = await db.from("profiles").select("id, login_id, full_name").in("id", assignedStaffIds).order("full_name");
    assignedStaff = (data ?? []) as Person[];
  }

  return ok({
    denied: false,
    campaign: c,
    memberCount: members.length,
    linkedCount: linkedIds.size,
    hasViews: views.length > 0,
    stats: { totalViews, totalEarned, thisWeekViews, lastWeekViews, delta },
    rows,
    assignedStaff,
    availableStaff,
    canManage: can(me, "campaigns.manage"),
    isSuper,
  });
}
