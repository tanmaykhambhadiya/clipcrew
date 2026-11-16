// Shapes returned by /api/pages/admin/views (the backend owns the loading).

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
