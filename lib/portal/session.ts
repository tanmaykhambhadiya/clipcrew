import "server-only";
import { cache } from "react";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { Permission, PortalRole } from "./permissions";

// ───────────── Sessions ─────────────
// The cookie holds a random 32-byte token; the database stores only its SHA-256, so a leaked
// database can't be used to sign in. Sessions last 30 days and are deleted on logout, password
// reset/change and termination.

export const SESSION_COOKIE = "cc_session";
const SESSION_DAYS = 30;

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a session for the user and sets the cookie (call from a route handler). */
export async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  const { error } = await getSupabaseAdmin()
    .from("sessions")
    .insert({ token_hash: tokenHash(token), user_id: userId, expires_at: expires.toISOString() });
  if (error) throw new Error(`Couldn't start the session: ${error.message}`);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

/** Ends the current session (logout). */
export async function endSession(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await getSupabaseAdmin().from("sessions").delete().eq("token_hash", tokenHash(token));
  cookies().delete(SESSION_COOKIE);
}

/** Signs a user out everywhere (password reset, termination). Optionally keeps the current session. */
export async function endAllSessions(userId: string, opts: { keepCurrent?: boolean } = {}): Promise<void> {
  let q = getSupabaseAdmin().from("sessions").delete().eq("user_id", userId);
  const token = opts.keepCurrent ? cookies().get(SESSION_COOKIE)?.value : undefined;
  if (token) q = q.neq("token_hash", tokenHash(token));
  const { error } = await q;
  if (error) console.error("[sessions] end all failed", error);
}

export type Me = {
  id: string;
  loginId: string;
  fullName: string;
  role: PortalRole;
  permissions: Permission[];
};

type ProfileRow = { id: string; login_id: string; full_name: string; role: PortalRole; status: string; permissions: Permission[] | null };

/** The signed-in, still-active user — or null. One database query per request (session + profile
 *  together); a terminated user or a deleted session loses access immediately.
 *  cache() runs this once per request even though the layout and the page both call it. */
export const getMe = cache(async (): Promise<Me | null> => {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const { data } = await getSupabaseAdmin()
    .from("sessions")
    .select("expires_at, profile:profiles!sessions_user_id_fkey(id, login_id, full_name, role, status, permissions)")
    .eq("token_hash", tokenHash(token))
    .maybeSingle();
  const row = data as { expires_at: string; profile: ProfileRow | null } | null;
  const p = row?.profile;
  if (!row || !p || new Date(row.expires_at) <= new Date() || p.status !== "active") return null;
  return { id: p.id, loginId: p.login_id, fullName: p.full_name, role: p.role, permissions: p.permissions ?? [] };
});

export const isStaff = (me: Me) => me.role === "super_admin" || me.role === "admin";

/** Super admin has every permission; staff only the ones ticked for them; clippers none. */
export function can(me: Me, permission: Permission): boolean {
  return me.role === "super_admin" || (me.role === "admin" && me.permissions.includes(permission));
}

export async function audit(
  actorId: string,
  action: string,
  entity: string,
  entityId: string | null,
  before?: unknown,
  after?: unknown,
) {
  const { error } = await getSupabaseAdmin()
    .from("audit_log")
    .insert({ actor_id: actorId, action, entity, entity_id: entityId, before: before ?? null, after: after ?? null });
  if (error) console.error("[audit] failed", error);
}
