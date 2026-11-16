import { getSupabaseAdmin } from "@/lib/supabase";
import { guard, ok, staffCampaignIds } from "@/lib/portal/guard";
import { can, type Me } from "@/lib/portal/session";
import { addDays, currentWeekStart } from "@/lib/portal/weeks";
import { balanceOf, clipperIdsForCampaigns, fetchAll, fetchBalances, fetchByIds } from "@/routes/api/admin/export/data";
import { loadActivity, type ActivityEntry } from "@/routes/api/admin/activity/load";

/** Runs a stat loader; a failure shows "—" instead of breaking the whole dashboard. */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error("[admin overview]", e);
    return fallback;
  }
}

async function loadStats(me: Me) {
  const db = getSupabaseAdmin();
  const scope = await staffCampaignIds(me); // null = all campaigns
  const none = scope !== null && scope.length === 0;
  const lastWeek = addDays(currentWeekStart(), -7);

  // Independent loads run together — each database round trip is slow from the app server.
  const [campaigns, clipperIds] = await Promise.all([
    safe(async () => {
      if (none) return [] as Array<{ id: string; name: string; status: string }>;
      let q = db.from("campaigns").select("id, name, status").order("created_at", { ascending: false });
      if (scope) q = q.in("id", scope);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string; status: string }>;
    }, null),
    safe(() => clipperIdsForCampaigns(scope), [] as string[] | null),
  ]);

  const [activeClippers, pending, week, unpaid, fines] = await Promise.all([
    safe(async () => {
      if (clipperIds === null) {
        const { count, error } = await db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "clipper").eq("status", "active");
        if (error) throw error;
        return count ?? 0;
      }
      const people = await fetchByIds<{ status: string; role: string }>("profiles", "id, status, role", clipperIds);
      return people.filter((p) => p.role === "clipper" && p.status === "active").length;
    }, null as number | null),

    can(me, "accounts.verify")
      ? safe(async () => {
          const { count, error } = await db.from("social_accounts").select("id", { count: "exact", head: true }).eq("status", "pending");
          if (error) throw error;
          return count ?? 0;
        }, null as number | null)
      : Promise.resolve(undefined),

    safe(async () => {
      if (none) return { views: 0, amount: 0, rows: 0 };
      const rows = await fetchAll<{ views: number; amount_paise: number }>((from, to) => {
        let q = db.from("weekly_views").select("views, amount_paise").eq("week_start", lastWeek);
        if (scope) q = q.in("campaign_id", scope);
        return q.range(from, to);
      });
      return {
        views: rows.reduce((s, r) => s + Number(r.views), 0),
        amount: rows.reduce((s, r) => s + Number(r.amount_paise), 0),
        rows: rows.length,
      };
    }, null as { views: number; amount: number; rows: number } | null),

    can(me, "payouts.manage")
      ? safe(async () => {
          const balances = await fetchBalances(clipperIds);
          const owed = balances.map(balanceOf).filter((b) => b > 0);
          return { total: owed.reduce((s, b) => s + b, 0), clippers: owed.length };
        }, null as { total: number; clippers: number } | null)
      : Promise.resolve(undefined),

    can(me, "fines.create") || can(me, "payouts.manage") || can(me, "rejections.send")
      ? safe(async () => {
          if (none) return { total: 0, count: 0 };
          const rows = await fetchAll<{ amount_paise: number }>((from, to) => {
            let q = db.from("fines").select("amount_paise").is("waived_at", null);
            if (scope) q = q.in("campaign_id", scope);
            return q.range(from, to);
          });
          return { total: rows.reduce((s, r) => s + Number(r.amount_paise), 0), count: rows.length };
        }, null as { total: number; count: number } | null)
      : Promise.resolve(undefined),
  ]);

  return { campaigns, activeClippers, pending, week, unpaid, fines, lastWeek, isScoped: scope !== null };
}

// GET /api/pages/admin/overview — the numbers on the admin overview (scoped to what this person may see)
// plus the latest activity for people who can view the log.
export async function GET() {
  const g = await guard({ staff: true });
  if ("error" in g) return g.error;
  const { me } = g;
  const recentPromise = can(me, "audit.view")
    ? safe(async () => (await loadActivity({ limit: 10 })).entries, null as ActivityEntry[] | null)
    : Promise.resolve(null as ActivityEntry[] | null);
  const stats = await loadStats(me);
  return ok({ ...stats, recent: await recentPromise });
}
