import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";

export const ACTIVITY_PAGE = 100;

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

/** One page of the audit log joined to actor names. Callers must have checked audit.view. */
export async function loadActivity(opts: { offset?: number; limit?: number; action?: string; actor?: string }) {
  const offset = opts.offset ?? 0;
  const limit = opts.limit ?? ACTIVITY_PAGE;
  const db = getSupabaseAdmin();

  let q = db
    .from("audit_log")
    .select("id, actor_id, action, entity, entity_id, before, after, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (opts.action) q = q.eq("action", opts.action);
  if (opts.actor) q = q.eq("actor_id", opts.actor);
  // Ask for one extra row to know whether there is another page.
  const { data, error } = await q.range(offset, offset + limit);
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    id: string;
    actor_id: string | null;
    action: string;
    entity: string;
    entity_id: string | null;
    before: unknown;
    after: unknown;
    created_at: string;
  }>;
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);

  const actorIds = Array.from(new Set(page.map((r) => r.actor_id).filter((x): x is string => !!x)));
  const actors = new Map<string, { id: string; full_name: string; login_id: string; role: string }>();
  if (actorIds.length) {
    const { data: people } = await db.from("profiles").select("id, full_name, login_id, role").in("id", actorIds);
    for (const p of people ?? []) actors.set(p.id, p);
  }

  const entries: ActivityEntry[] = page.map((r) => {
    const a = r.actor_id ? actors.get(r.actor_id) : undefined;
    return {
      id: r.id,
      action: r.action,
      entity: r.entity,
      entity_id: r.entity_id,
      before: r.before,
      after: r.after,
      created_at: r.created_at,
      actor: a ? { id: a.id, name: a.full_name, loginId: a.login_id, role: a.role } : null,
    };
  });

  return { entries, hasMore, nextOffset: offset + page.length };
}
