import "server-only";
import { cache } from "react";
import { ApiError, serverApi } from "@/lib/server-api";
import type { Permission, PortalRole } from "./permissions";

// Who is signed in, as told by the backend (GET /api/me). The frontend never touches the database or
// session tokens directly: it forwards the visitor's cookie and the backend answers.

export type Me = {
  id: string;
  loginId: string;
  fullName: string;
  role: PortalRole;
  permissions: Permission[];
};

/** Resolved once per request even though layouts and pages both ask. */
const loadSession = cache(async (): Promise<{ me: Me; unread: number } | null> => {
  try {
    const r = await serverApi<{ me: Me; unread: number }>("/api/me");
    return { me: r.me, unread: r.unread ?? 0 };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return null;
    throw e;
  }
});

export const getMe = cache(async (): Promise<Me | null> => (await loadSession())?.me ?? null);

/** Unread notification count (clippers; 0 for staff). */
export const getUnreadCount = async (): Promise<number> => (await loadSession())?.unread ?? 0;

export const isStaff = (me: Me) => me.role === "super_admin" || me.role === "admin";

/** Super admin has every permission; staff only the ones ticked for them; clippers none.
 *  (UI convenience only — the backend enforces permissions on every request.) */
export function can(me: Me, permission: Permission): boolean {
  return me.role === "super_admin" || (me.role === "admin" && me.permissions.includes(permission));
}
