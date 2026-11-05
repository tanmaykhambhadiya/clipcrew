import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";

// Server-only loaders for a single clipper's money. Every query is filtered by the clipper's id
// (directly, or through the accounts they own) so one clipper can never see another's data.

export type EarningRow = {
  campaignId: string;
  accountId: string;
  weekStart: string;
  views: number;
  amountPaise: number;
};

export type AccountInfo = { id: string; platform: string; username: string; status: string };
export type CampaignInfo = { id: string; name: string; status: string };

export type Balance = { earnedPaise: number; finesPaise: number; paidPaise: number; balancePaise: number };

const PAGE = 1000;

/** Every weekly_views row for accounts owned by `clipperId`, plus lookups for accounts and campaigns. */
export async function loadClipperEarnings(clipperId: string) {
  const db = getSupabaseAdmin();

  const [{ data: accs, error: accErr }, { data: joined, error: joinErr }] = await Promise.all([
    db.from("social_accounts").select("id, platform, username, status").eq("clipper_id", clipperId),
    db.from("campaign_clippers").select("campaign_id").eq("clipper_id", clipperId),
  ]);
  if (accErr || joinErr) throw new Error("Couldn't load your accounts.");

  const accounts = new Map<string, AccountInfo>((accs ?? []).map((a) => [a.id, a as AccountInfo]));
  const accountIds = Array.from(accounts.keys());

  const rows: EarningRow[] = [];
  if (accountIds.length) {
    // Page through so a long history is never silently cut at the API row limit.
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from("weekly_views")
        .select("id, campaign_id, account_id, week_start, views, amount_paise")
        .in("account_id", accountIds)
        .order("week_start", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error("Couldn't load your earnings.");
      for (const r of data ?? []) {
        rows.push({
          campaignId: r.campaign_id,
          accountId: r.account_id,
          weekStart: r.week_start,
          views: Number(r.views),
          amountPaise: Number(r.amount_paise),
        });
      }
      if (!data || data.length < PAGE) break;
    }
  }

  const joinedIds = (joined ?? []).map((j) => j.campaign_id as string);
  const campaignIds = Array.from(new Set([...joinedIds, ...rows.map((r) => r.campaignId)]));
  const campaigns = new Map<string, CampaignInfo>();
  if (campaignIds.length) {
    const { data } = await db.from("campaigns").select("id, name, status").in("id", campaignIds);
    for (const c of data ?? []) campaigns.set(c.id, c as CampaignInfo);
  }

  return { rows, accounts, campaigns, joinedCampaignIds: joinedIds };
}

/** Balance from the clipper_balances view: earned − active fines − paid out. */
export async function loadBalance(clipperId: string): Promise<Balance> {
  const { data } = await getSupabaseAdmin()
    .from("clipper_balances")
    .select("earned_paise, fines_paise, paid_paise")
    .eq("clipper_id", clipperId)
    .maybeSingle();
  const earned = Number(data?.earned_paise ?? 0);
  const fines = Number(data?.fines_paise ?? 0);
  const paid = Number(data?.paid_paise ?? 0);
  return { earnedPaise: earned, finesPaise: fines, paidPaise: paid, balancePaise: earned - fines - paid };
}

export function accountLabel(a: AccountInfo | undefined): string {
  return a ? `@${a.username}` : "Removed account";
}
