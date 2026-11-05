// Readable names for audit_log actions. Unknown actions fall back to "Some action name".

export const ACTION_LABELS: Record<string, string> = {
  LOGIN: "Signed in",
  LOGOUT: "Signed out",
  PASSWORD_CHANGED: "Changed own password",
  PROFILE_UPDATED: "Updated payout details",
  DATA_EXPORTED: "Exported CSV",

  USER_CREATED: "User added",
  USER_UPDATED: "User edited",
  USER_TERMINATED: "User terminated",
  USER_REACTIVATED: "User reactivated",
  PASSWORD_RESET: "Password reset",
  PERMISSIONS_CHANGED: "Permissions changed",

  CAMPAIGN_CREATED: "Campaign created",
  CAMPAIGN_UPDATED: "Campaign edited",
  CAMPAIGN_STATUS_CHANGED: "Campaign status changed",
  CAMPAIGN_DELETED: "Campaign deleted",
  RATE_CHANGED: "Campaign rate changed",
  STAFF_ASSIGNED: "Staff assigned",
  STAFF_UNASSIGNED: "Staff removed",
  STAFF_CHANGED: "Staff changed",
  CLIPPER_ADDED: "Clipper added to campaign",
  CLIPPER_REMOVED: "Clipper removed from campaign",
  CLIPPER_JOINED: "Clipper joined campaign",
  CLIPPER_LEFT: "Clipper left campaign",
  CAMPAIGN_JOINED: "Clipper joined campaign",
  CAMPAIGN_LEFT: "Clipper left campaign",

  ACCOUNT_ADDED: "Social account added",
  ACCOUNT_SUBMITTED: "Social account submitted",
  ACCOUNT_CODE_SENT: "Verification code sent",
  ACCOUNT_VERIFIED: "Social account verified",
  ACCOUNT_REJECTED: "Social account rejected",
  ACCOUNT_REMOVED: "Social account removed",
  ACCOUNT_DELETED: "Social account removed",
  ACCOUNT_LINKED: "Account linked to campaign",
  ACCOUNT_UNLINKED: "Account unlinked from campaign",

  VIEWS_SET: "Weekly views saved",
  VIEWS_UPDATED: "Weekly views saved",
  VIEWS_DELETED: "Weekly views removed",
  VIEWS_CLEARED: "Weekly views cleared",

  // Exact names used by the API routes.
  ACCOUNT_REVOKED: "Account verification revoked",
  ANNOUNCEMENT_SENT: "Announcement sent",
  CAMPAIGN_ACCOUNTS_SET: "Clipper chose campaign accounts",
  CAMPAIGN_STAFF_ASSIGNED: "Staff assigned to campaign",
  CAMPAIGN_STAFF_REMOVED: "Staff removed from campaign",
  CLIPPER_ADDED_TO_CAMPAIGN: "Clipper added to campaign",
  CLIPPER_REMOVED_FROM_CAMPAIGN: "Clipper removed from campaign",

  REJECTION_SENT: "Reel rejection sent",
  REEL_REJECTED: "Reel rejection sent",
  FINE_CREATED: "Fine added",
  FINE_ADDED: "Fine added",
  FINE_WAIVED: "Fine waived",
  NOTIFICATION_SENT: "Message sent",

  PAYOUT_RECORDED: "Payout recorded",
  PAYOUT_CREATED: "Payout recorded",
  PAYOUT_DELETED: "Payout removed",
};

export function actionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const s = action.toLowerCase().replace(/_/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : action;
}

/** Colour hint for the action pill. */
export function actionTone(action: string): "lime" | "red" | "amber" | "grey" | "cyan" {
  if (/TERMINATED|REJECT|DELETED|REMOVED|FINE_CREATED|FINE_ADDED|UNASSIGNED|UNLINKED/.test(action)) return "red";
  if (/RATE|PERMISSION|PASSWORD|WAIVED/.test(action)) return "amber";
  if (/PAYOUT|VERIFIED|VIEWS/.test(action)) return "lime";
  if (/LOGIN|LOGOUT|EXPORT/.test(action)) return "grey";
  return "cyan";
}
