import { getSupabaseAdmin } from "@/lib/supabase";
import { guard, ok, staffCampaignIds } from "@/lib/portal/guard";
import { addDays, currentWeekStart, isMonday, recentWeeks } from "@/lib/portal/weeks";
import { loadGrid } from "@/loaders/views";

const STATUS_ORDER: Record<string, number> = { active: 0, paused: 1, draft: 2, ended: 3 };

// GET /api/pages/admin/views?campaign=&week= — campaigns the person may work on, the week choices,
// and the entry grid for the chosen campaign + week.
export async function GET(req: Request) {
  const g = await guard({ permission: "views.enter" });
  if ("error" in g) return g.error;
  const { me } = g;
  const url = new URL(req.url);
  const campaignParam = url.searchParams.get("campaign") ?? "";
  const weekParam = url.searchParams.get("week") ?? "";

  // Campaigns this person may work on (super admin = all).
  const allowed = await staffCampaignIds(me);
  let campaigns: { id: string; name: string; client: string | null; status: string; ratePerMillionPaise: number }[] = [];
  let loadError = "";
  if (allowed === null || allowed.length > 0) {
    let q = getSupabaseAdmin().from("campaigns").select("id, name, client, status, rate_per_million_paise");
    if (allowed) q = q.in("id", allowed);
    const { data, error } = await q;
    if (error) loadError = "Couldn't load your campaigns. Please refresh.";
    campaigns = (data ?? [])
      .map((c: any) => ({ id: c.id, name: c.name, client: c.client, status: c.status, ratePerMillionPaise: Number(c.rate_per_million_paise) }))
      .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || a.name.localeCompare(b.name));
  }
  if (loadError || campaigns.length === 0) return ok({ loadError, campaigns: [] });

  // Week: default = the last completed week. Never a future week.
  const thisWeek = currentWeekStart();
  const weeks = recentWeeks(16);
  const week = weekParam && isMonday(weekParam) && weekParam <= thisWeek ? weekParam : addDays(thisWeek, -7);
  if (!weeks.includes(week)) {
    weeks.push(week);
    weeks.sort((a, b) => (a < b ? 1 : -1));
  }
  const campaign = campaigns.find((c) => c.id === campaignParam) ?? campaigns[0];

  let grid: Awaited<ReturnType<typeof loadGrid>> | null = null;
  let gridError = "";
  try {
    grid = await loadGrid(campaign as Parameters<typeof loadGrid>[0], week);
  } catch (e) {
    gridError = e instanceof Error ? e.message : "Couldn't load this week's views.";
  }
  return ok({ loadError: "", campaigns, weeks, week, currentWeek: thisWeek, campaignId: campaign.id, grid, gridError, isSuper: me.role === "super_admin" });
}
