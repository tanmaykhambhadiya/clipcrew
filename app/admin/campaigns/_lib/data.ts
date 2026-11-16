// Shape returned by /api/pages/admin/campaigns (the backend owns the loading).

export type CampaignRow = {
  id: string;
  name: string;
  client: string | null;
  rate_per_million_paise: number;
  allowed_platforms: string[];
  max_accounts_per_clipper: number;
  status: "draft" | "active" | "paused" | "ended";
  starts_on: string | null;
  ends_on: string | null;
  created_at: string;
};
