import { getSupabaseAdmin } from "@/lib/supabase";
import { sql } from "@/db/pool";

export type ClipperCampaign = {
  id: string;
  name: string;
  client: string | null;
  rate_per_million_paise: number;
  allowed_platforms: string[];
  max_accounts_per_clipper: number;
  status: "draft" | "active" | "paused" | "ended";
  starts_on: string | null;
  ends_on: string | null;
  joined_at: string;
  linkedAccountIds: string[];
  /** linked accounts that already have weekly views in this campaign (can't be unlinked) */
  lockedAccountIds: string[];
  views: number;
  earned_paise: number;
};

export type MyAccount = { id: string; platform: string; username: string; status: "pending" | "verified" | "rejected" };

/** Everything the clipper campaigns screen needs — always scoped to this clipper. */
export async function loadClipperCampaigns(clipperId: string): Promise<{ campaigns: ClipperCampaign[]; accounts: MyAccount[]; error: string | null }> {
  const supabase = getSupabaseAdmin();

  const [{ data: memberships, error: mErr }, { data: accounts, error: aErr }] = await Promise.all([
    sql<any>(
      `select cc.joined_at, c.id, c.name, c.client, c.rate_per_million_paise, c.allowed_platforms,
              c.max_accounts_per_clipper, c.status, c.starts_on, c.ends_on
         from campaign_clippers cc join campaigns c on c.id = cc.campaign_id
        where cc.clipper_id = $1`,
      [clipperId],
    )
      .then((rows) => ({
        data: rows.map(({ joined_at, ...campaign }: any) => ({ joined_at, campaign })),
        error: null as null | string,
      }))
      .catch(() => ({ data: null as any, error: "query failed" })),
    supabase.from("social_accounts").select("id, platform, username, status").eq("clipper_id", clipperId).order("created_at"),
  ]);
  if (mErr || aErr) return { campaigns: [], accounts: [], error: "Couldn't load your campaigns." };

  type Row = { joined_at: string; campaign: Omit<ClipperCampaign, "joined_at" | "linkedAccountIds" | "lockedAccountIds" | "views" | "earned_paise"> | null };
  const rows = ((memberships ?? []) as unknown as Row[]).filter((m) => m.campaign && m.campaign.status !== "draft");
  const campaignIds = rows.map((r) => r.campaign!.id);
  const accountIds = (accounts ?? []).map((a) => a.id);

  const links: { campaign_id: string; account_id: string }[] = [];
  const views: { campaign_id: string; account_id: string; views: number; amount_paise: number }[] = [];
  if (campaignIds.length && accountIds.length) {
    const [{ data: l }, { data: v }] = await Promise.all([
      supabase.from("campaign_accounts").select("campaign_id, account_id").in("campaign_id", campaignIds).in("account_id", accountIds),
      supabase.from("weekly_views").select("campaign_id, account_id, views, amount_paise").in("campaign_id", campaignIds).in("account_id", accountIds),
    ]);
    links.push(...(l ?? []));
    views.push(...((v ?? []) as typeof views));
  }

  const order = { active: 0, paused: 1, ended: 2, draft: 3 } as const;
  const campaigns: ClipperCampaign[] = rows
    .map((r) => {
      const c = r.campaign!;
      const mine = views.filter((v) => v.campaign_id === c.id);
      return {
        ...c,
        rate_per_million_paise: Number(c.rate_per_million_paise),
        allowed_platforms: c.allowed_platforms ?? [],
        joined_at: r.joined_at,
        linkedAccountIds: links.filter((l) => l.campaign_id === c.id).map((l) => l.account_id),
        lockedAccountIds: Array.from(new Set(mine.map((v) => v.account_id))),
        views: mine.reduce((s, v) => s + Number(v.views), 0),
        earned_paise: mine.reduce((s, v) => s + Number(v.amount_paise), 0),
      };
    })
    .sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));

  return { campaigns, accounts: (accounts ?? []) as MyAccount[], error: null };
}
