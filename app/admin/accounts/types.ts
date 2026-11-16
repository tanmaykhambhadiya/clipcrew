// Shapes returned by GET /api/admin/accounts.

export const ACCOUNT_TABS = ["pending", "verified", "rejected", "all"] as const;
export type AccountTab = (typeof ACCOUNT_TABS)[number];

export type QueueRow = {
  id: string;
  platform: string;
  username: string;
  verify_code: string;
  status: "pending" | "verified" | "rejected";
  created_at: string;
  verified_at: string | null;
  clipper: { id: string; full_name: string; login_id: string; status: string } | null;
  verifier: { full_name: string } | null;
};
