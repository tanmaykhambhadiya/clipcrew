// Why a clipper's password can't be shown (reasons returned by GET /api/admin/users/:id/password).
export const PASSWORD_GONE: Record<string, string> = {
  changed_by_clipper: "Not available — the clipper chose their own password (or the account is older than this feature). Use Reset password to issue a new one.",
  key_changed: "Not available — the server's SECRET_KEY changed since this password was set. Use Reset password to issue a new one.",
  disabled: "Viewing passwords is off: set SECRET_KEY on the backend in Coolify, then reset this clipper's password.",
};
