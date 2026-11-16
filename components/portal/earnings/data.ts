import "server-only";
import { pageApi } from "@/lib/server-api";

// Shapes of a clipper's earnings, as returned by the backend (/api/pages/portal/earnings and /wallet).

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

export type EarningsPayload = {
  rows: EarningRow[];
  accounts: AccountInfo[];
  campaigns: CampaignInfo[];
  joinedCampaignIds: string[];
  balance: Balance;
};

/** Turns the JSON arrays back into the Maps the pages work with. */
export function hydrateEarnings(p: EarningsPayload) {
  return {
    rows: p.rows,
    accounts: new Map(p.accounts.map((a) => [a.id, a] as const)),
    campaigns: new Map(p.campaigns.map((c) => [c.id, c] as const)),
    joinedCampaignIds: p.joinedCampaignIds,
    balance: p.balance,
  };
}

export async function loadEarnings() {
  return hydrateEarnings(await pageApi<EarningsPayload>("/api/pages/portal/earnings", { forbiddenTo: "/login" }));
}

export function accountLabel(a: AccountInfo | undefined): string {
  return a ? `@${a.username}` : "Removed account";
}
