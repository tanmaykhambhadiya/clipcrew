import { createHash, randomBytes } from "node:crypto";
import { cookies } from "@/runtime/context";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sqlOne } from "@/db/pool";
import type { Permission, PortalRole } from "./permissions";

// ───────────── Sessions ─────────────
// The cookie holds a random 32-byte token; the database stores only its SHA-256, so a leaked
// database can't be used to sign in. Sessions last 30 days and are deleted on logout, password
// reset/change and termination.
//
// The cookie is set by this API. In production COOKIE_DOMAIN is the frontend's host
// (e.g. clipcrew.ignitralabs.com), which makes the browser send it to both the frontend and the
// api. subdomain; in development it is unset (host-only, shared across localhost ports).

export const SESSION_COOKIE = "cc_session";
const SESSION_DAYS = 30;

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

const cookieBase = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  domain: process.env.COOKIE_DOMAIN || undefined,
});

/** Creates a session for the user and sets the cookie (call from a route handler). */
export async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  const { error } = await getSupabaseAdmin()
    .from("sessions")
    .insert({ token_hash: tokenHash(token), user_id: userId, expires_at: expires.toISOString() });
  if (error) throw new Error(`Couldn't start the session: ${error.message}`);
  cookies().set(SESSION_COOKIE, token, { ...cookieBase(), expires });
}

/** Ends the current session (logout). */
export async function endSession(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await getSupabaseAdmin().from("sessions").delete().eq("token_hash", tokenHash(token));
  cookies().delete(SESSION_COOKIE, cookieBase());
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

/** The signed-in, still-active user — or null. One query (session + profile together); a terminated
 *  user or a deleted session loses access immediately. */
export async function getMe(): Promise<Me | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const row = await sqlOne<{
    id: string; login_id: string; full_name: string; role: PortalRole; status: string; permissions: Permission[] | null;
  }>(
    `select p.id, p.login_id, p.full_name, p.role, p.status, p.permissions
       from sessions s join profiles p on p.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`,
    [tokenHash(token)],
  );
  if (!row || row.status !== "active") return null;
  return { id: row.id, loginId: row.login_id, fullName: row.full_name, role: row.role, permissions: row.permissions ?? [] };
}

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
