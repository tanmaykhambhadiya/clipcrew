import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { Permission, PortalRole } from "./permissions";

/** Supabase client bound to the visitor's session cookies (anon key — used only for auth calls). */
export function supabaseSession() {
  const store = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // called from a Server Component: the middleware refreshes the session instead
        }
      },
    },
  });
}

export type Me = {
  id: string;
  loginId: string;
  fullName: string;
  role: PortalRole;
  permissions: Permission[];
};

/** The signed-in, still-active user — or null. Checked against the database on every request, so a
 *  terminated user loses access immediately even while their token is still valid.
 *  - getClaims() verifies the session JWT locally (asymmetric signing keys), instead of a round trip
 *    to Supabase Auth like getUser() — the app server and database are far apart, so trips are costly.
 *  - cache() runs this once per request even though the layout and the page both call it. */
export const getMe = cache(async (): Promise<Me | null> => {
  const { data } = await supabaseSession().auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  const { data: p } = await getSupabaseAdmin()
    .from("profiles")
    .select("id, login_id, full_name, role, status, permissions")
    .eq("id", userId)
    .maybeSingle();
  if (!p || p.status !== "active") return null;
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
