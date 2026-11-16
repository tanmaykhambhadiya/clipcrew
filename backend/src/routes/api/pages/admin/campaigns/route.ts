import { getSupabaseAdmin } from "@/lib/supabase";
import { guard, ok, staffCampaignIds } from "@/lib/portal/guard";
import { CAMPAIGN_COLUMNS, fetchAll, fetchIn, weeklyViewsFor, type CampaignRow } from "@/loaders/campaignData";

const STATUSES = ["draft", "active", "paused", "ended"];

// GET /api/pages/admin/campaigns?status=&q= — the campaigns list with per-campaign totals.
// Super admin sees every campaign; staff only the ones assigned to them.
export async function GET(req: Request) {
  const g = await guard({ staff: true });
  if ("error" in g) return g.error;
  const { me } = g;
  const url = new URL(req.url);
  const status = STATUSES.includes(url.searchParams.get("status") ?? "") ? url.searchParams.get("status")! : "";
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);

  const db = getSupabaseAdmin();
  const scope = await staffCampaignIds(me);

  let campaigns: CampaignRow[] = [];
  let loadError = "";
  const totals: Record<string, { views: number; earned: number; clippers: number }> = {};

  try {
    if (scope === null) {
      campaigns = await fetchAll<CampaignRow>((from, to) =>
        db.from("campaigns").select(CAMPAIGN_COLUMNS).order("created_at", { ascending: false }).range(from, to),
      );
    } else if (scope.length) {
      campaigns = await fetchIn<CampaignRow>(scope, (chunk, from, to) =>
        db.from("campaigns").select(CAMPAIGN_COLUMNS).in("id", chunk).order("created_at", { ascending: false }).range(from, to),
      );
      campaigns.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }

    if (status) campaigns = campaigns.filter((c) => c.status === status);
    if (q) {
      const needle = q.toLowerCase();
      campaigns = campaigns.filter((c) => c.name.toLowerCase().includes(needle) || (c.client ?? "").toLowerCase().includes(needle));
    }

    const ids = campaigns.map((c) => c.id);
    for (const id of ids) totals[id] = { views: 0, earned: 0, clippers: 0 };
    if (ids.length) {
      const [views, members] = await Promise.all([
        weeklyViewsFor(ids),
        fetchIn<{ campaign_id: string }>(ids, (chunk, from, to) =>
          db.from("campaign_clippers").select("campaign_id").in("campaign_id", chunk).order("campaign_id").order("clipper_id").range(from, to),
        ),
      ]);
      for (const v of views) {
        const t = totals[v.campaign_id];
        t.views += Number(v.views);
        t.earned += Number(v.amount_paise);
      }
      for (const m of members) totals[m.campaign_id].clippers += 1;
    }
  } catch (e) {
    console.error("[campaigns] list failed", e);
    loadError = "Couldn't load campaigns. Refresh to try again.";
  }

  return ok({ campaigns, totals, loadError, scoped: scope !== null });
}
