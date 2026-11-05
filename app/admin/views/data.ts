import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import { addDays } from "@/lib/portal/weeks";

// Shared by the /admin/views page and the /api/admin/views routes. Callers must already have
// checked views.enter + campaign access — this only reads.

export type GridCampaign = {
  id: string;
  name: string;
  client: string | null;
  status: "draft" | "active" | "paused" | "ended";
  ratePerMillionPaise: number;
};

export type GridRow = {
  accountId: string;
  clipperId: string;
  clipperName: string;
  clipperLoginId: string;
  clipperTerminated: boolean;
  platform: string;
  username: string;
  accountStatus: "pending" | "verified" | "rejected";
  /** false = has a saved row for this week but the account is no longer linked to the campaign */
  linked: boolean;
  lastWeekViews: number | null;
  saved: { views: number; ratePerMillionPaise: number; amountPaise: number; updatedAt: string; enteredBy: string | null } | null;
};

export type Grid = { campaign: GridCampaign; weekStart: string; rows: GridRow[] };

export async function loadCampaign(campaignId: string): Promise<GridCampaign | null> {
  const { data } = await getSupabaseAdmin()
    .from("campaigns")
    .select("id, name, client, status, rate_per_million_paise")
    .eq("id", campaignId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    client: data.client,
    status: data.status,
    ratePerMillionPaise: Number(data.rate_per_million_paise),
  };
}

export async function loadGrid(campaign: GridCampaign, weekStart: string): Promise<Grid> {
  const db = getSupabaseAdmin();
  const prevWeek = addDays(weekStart, -7);

  const [linksRes, viewsRes] = await Promise.all([
    db.from("campaign_accounts").select("account_id").eq("campaign_id", campaign.id),
    db
      .from("weekly_views")
      .select("account_id, week_start, views, rate_per_million_paise, amount_paise, updated_at, entered_by")
      .eq("campaign_id", campaign.id)
      .in("week_start", [weekStart, prevWeek]),
  ]);
  if (linksRes.error || viewsRes.error) throw new Error("Couldn't load this week's views.");

  const linkedIds = new Set((linksRes.data ?? []).map((r) => r.account_id as string));
  const views = viewsRes.data ?? [];
  const thisWeek = new Map(views.filter((v) => v.week_start === weekStart).map((v) => [v.account_id as string, v]));
  const lastWeek = new Map(views.filter((v) => v.week_start === prevWeek).map((v) => [v.account_id as string, Number(v.views)]));

  // linked accounts + any account that still has a saved row this week (so totals are honest)
  const accountIds = Array.from(new Set([...Array.from(linkedIds), ...Array.from(thisWeek.keys())]));
  if (accountIds.length === 0) return { campaign, weekStart, rows: [] };

  const { data: accounts, error: accErr } = await db
    .from("social_accounts")
    .select("id, clipper_id, platform, username, status")
    .in("id", accountIds);
  if (accErr) throw new Error("Couldn't load the linked accounts.");

  const clipperIds = Array.from(new Set((accounts ?? []).map((a) => a.clipper_id as string)));
  const { data: profiles, error: profErr } = clipperIds.length
    ? await db.from("profiles").select("id, full_name, login_id, status").in("id", clipperIds)
    : { data: [], error: null };
  if (profErr) throw new Error("Couldn't load the clippers.");
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  const rows: GridRow[] = (accounts ?? []).map((a) => {
    const p = byId.get(a.clipper_id);
    const s = thisWeek.get(a.id);
    return {
      accountId: a.id,
      clipperId: a.clipper_id,
      clipperName: p?.full_name ?? "Unknown clipper",
      clipperLoginId: p?.login_id ?? "",
      clipperTerminated: p?.status === "terminated",
      platform: a.platform,
      username: a.username,
      accountStatus: a.status,
      linked: linkedIds.has(a.id),
      lastWeekViews: lastWeek.has(a.id) ? lastWeek.get(a.id)! : null,
      saved: s
        ? {
            views: Number(s.views),
            ratePerMillionPaise: Number(s.rate_per_million_paise),
            amountPaise: Number(s.amount_paise),
            updatedAt: s.updated_at,
            enteredBy: s.entered_by ?? null,
          }
        : null,
    };
  });

  rows.sort(
    (x, y) =>
      Number(y.linked) - Number(x.linked) ||
      x.clipperName.localeCompare(y.clipperName) ||
      x.platform.localeCompare(y.platform) ||
      x.username.localeCompare(y.username),
  );
  return { campaign, weekStart, rows };
}
