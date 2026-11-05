import { redirect } from "next/navigation";
import { EmptyState, ErrorNote, PageTitle } from "@/components/portal/ui";
import { staffCampaignIds } from "@/lib/portal/guard";
import { can, getMe } from "@/lib/portal/session";
import { getSupabaseAdmin } from "@/lib/supabase";
import { addDays, currentWeekStart, isMonday, recentWeeks } from "@/lib/portal/weeks";
import { loadGrid, type Grid, type GridCampaign } from "./data";
import { ViewsEntry } from "./ViewsEntry";

export const dynamic = "force-dynamic";

const STATUS_ORDER: Record<string, number> = { active: 0, paused: 1, draft: 2, ended: 3 };

export default async function WeeklyViewsPage({ searchParams }: { searchParams: { campaign?: string; week?: string } }) {
  const me = await getMe();
  if (!me || !can(me, "views.enter")) redirect("/admin");

  // Campaigns this person may work on (super admin = all).
  const allowed = await staffCampaignIds(me);
  let campaigns: GridCampaign[] = [];
  let loadError = "";
  if (allowed === null || allowed.length > 0) {
    let q = getSupabaseAdmin().from("campaigns").select("id, name, client, status, rate_per_million_paise");
    if (allowed) q = q.in("id", allowed);
    const { data, error } = await q;
    if (error) loadError = "Couldn't load your campaigns. Please refresh.";
    campaigns = (data ?? [])
      .map((c) => ({ id: c.id, name: c.name, client: c.client, status: c.status, ratePerMillionPaise: Number(c.rate_per_million_paise) }))
      .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || a.name.localeCompare(b.name));
  }

  const title = (
    <PageTitle eyebrow="Weekly views" line1="Enter the numbers," line2="we do the maths." />
  );

  if (loadError) {
    return (
      <div className="space-y-8">
        {title}
        <ErrorNote>{loadError}</ErrorNote>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="space-y-8">
        {title}
        <EmptyState title="No campaigns to work on yet.">
          {me.role === "super_admin"
            ? "Create a campaign first — then you can enter weekly views for the accounts linked to it."
            : "You haven't been assigned to any campaign. Ask the super admin to add you to one."}
        </EmptyState>
      </div>
    );
  }

  // Week: default = the last completed week. Never a future week.
  const thisWeek = currentWeekStart();
  const weeks = recentWeeks(16);
  const week = searchParams.week && isMonday(searchParams.week) && searchParams.week <= thisWeek ? searchParams.week : addDays(thisWeek, -7);
  if (!weeks.includes(week)) {
    weeks.push(week);
    weeks.sort((a, b) => (a < b ? 1 : -1));
  }

  const campaign = campaigns.find((c) => c.id === searchParams.campaign) ?? campaigns[0];

  let grid: Grid | null = null;
  let gridError = "";
  try {
    grid = await loadGrid(campaign, week);
  } catch (e) {
    gridError = e instanceof Error ? e.message : "Couldn't load this week's views.";
  }

  return (
    <div className="space-y-8">
      {title}
      {gridError || !grid ? (
        <ErrorNote>{gridError || "Couldn't load this week's views."}</ErrorNote>
      ) : (
        <ViewsEntry
          key={`${campaign.id}:${week}`}
          campaigns={campaigns.map(({ id, name, client, status }) => ({ id, name, client, status }))}
          weeks={weeks}
          currentWeek={thisWeek}
          initialGrid={grid}
          isSuper={me.role === "super_admin"}
        />
      )}
    </div>
  );
}
