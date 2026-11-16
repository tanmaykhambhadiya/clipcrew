import { redirect } from "next/navigation";
import { EmptyState, ErrorNote, PageTitle } from "@/components/portal/ui";
import { can, getMe } from "@/lib/portal/session";
import { pageApi } from "@/lib/server-api";
import type { Grid, GridCampaign } from "./data";
import { ViewsEntry } from "./ViewsEntry";

export const dynamic = "force-dynamic";

export default async function WeeklyViewsPage({ searchParams }: { searchParams: { campaign?: string; week?: string } }) {
  const me = await getMe();
  if (!me || !can(me, "views.enter")) redirect("/admin");

  const qs = new URLSearchParams();
  if (searchParams.campaign) qs.set("campaign", searchParams.campaign);
  if (searchParams.week) qs.set("week", searchParams.week);
  const data = await pageApi<{
    loadError: string;
    campaigns: GridCampaign[];
    weeks: string[];
    week: string;
    currentWeek: string;
    campaignId: string;
    grid: Grid | null;
    gridError: string;
  }>(`/api/pages/admin/views?${qs}`);
  const { loadError, campaigns } = data;

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

  const { weeks, week, currentWeek: thisWeek, grid, gridError } = data;
  const campaign = campaigns.find((c) => c.id === data.campaignId) ?? campaigns[0];

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
