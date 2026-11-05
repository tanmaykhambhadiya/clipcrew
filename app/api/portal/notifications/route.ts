import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fail, guard, ok, parseBody } from "@/lib/portal/guard";
import { loadInbox } from "@/app/portal/inbox/load";

export const dynamic = "force-dynamic";

// GET /api/portal/notifications?cursor=… — the signed-in clipper's own notifications, 50 at a time.
export async function GET(req: Request) {
  const g = await guard({ clipper: true });
  if ("error" in g) return g.error;
  const cursor = new URL(req.url).searchParams.get("cursor");
  try {
    const { items, nextCursor } = await loadInbox(g.me.id, cursor);
    return ok({ items, nextCursor });
  } catch (e) {
    if (e instanceof Error && e.message === "bad cursor") return fail(400, "Couldn't load more — refresh the page.");
    console.error("[inbox] load failed", e);
    return fail(500, "Couldn't load your inbox.");
  }
}

const schema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ ids: z.array(z.uuid()).min(1).max(200) }),
]);

// POST /api/portal/notifications — mark read: { ids: [...] } or { all: true }. Only ever the caller's own rows.
export async function POST(req: Request) {
  const g = await guard({ clipper: true });
  if ("error" in g) return g.error;
  const p = await parseBody(req, schema);
  if ("error" in p) return p.error;

  let q = getSupabaseAdmin()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("clipper_id", g.me.id)
    .is("read_at", null);
  if ("ids" in p.data) q = q.in("id", p.data.ids);
  const { data, error } = await q.select("id");
  if (error) {
    console.error("[inbox] mark read failed", error);
    return fail(500, "Couldn't update your inbox.");
  }
  return ok({ updated: (data ?? []).length });
}
