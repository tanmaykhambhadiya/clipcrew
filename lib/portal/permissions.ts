// Staff permissions — must match the check constraint on profiles.permissions.
export const PERMISSIONS = [
  { key: "users.create", label: "Add clippers & reset their passwords" },
  { key: "accounts.verify", label: "Verify or reject clipper accounts" },
  { key: "campaigns.manage", label: "Create/edit campaigns, assign clippers" },
  { key: "views.enter", label: "Enter weekly views" },
  { key: "rejections.send", label: "Send reel-rejected notices" },
  { key: "fines.create", label: "Add fines" },
  { key: "payouts.manage", label: "Record payouts" },
  { key: "audit.view", label: "See the activity log" },
  { key: "export.data", label: "Export CSV" },
] as const;

export type Permission = (typeof PERMISSIONS)[number]["key"];
export type PortalRole = "super_admin" | "admin" | "clipper";

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as Permission[];

/** Login IDs become the local part of an internal auth email; nothing is ever sent to it. */
export const LOGIN_EMAIL_DOMAIN = "portal.ignitralabs.com";
export const loginIdToEmail = (loginId: string) => `${loginId.toLowerCase()}@${LOGIN_EMAIL_DOMAIN}`;
