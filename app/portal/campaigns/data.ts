// Shapes returned by /api/pages/portal/campaigns (the backend owns the loading).

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
