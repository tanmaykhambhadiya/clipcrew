// Shapes of data the backend returns to pages. (The backend owns the real definitions; keep in sync.)

export type ActivityEntry = {
  id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  before: unknown;
  after: unknown;
  created_at: string;
  actor: { id: string; name: string; loginId: string; role: string } | null;
};

export type InboxItem = {
  id: string;
  kind: "reel_rejected" | "fine" | "account_verified" | "account_rejected" | "payout" | "info";
  title: string;
  body: string | null;
  reelRef: string | null;
  campaignName: string | null;
  createdAt: string;
  readAt: string | null;
};
