import { getSupabaseAdmin } from "@/lib/supabase";
import { fail, ok } from "@/lib/portal/guard";
import { getMe } from "@/lib/portal/session";

// GET /api/me — who is signed in (used by the frontend's layouts and pages). For clippers it also
// returns the unread-notification count shown on the bell.
export async function GET() {
  const me = await getMe();
  if (!me) return fail(401, "Please sign in again.");
  let unread = 0;
  if (me.role === "clipper") {
    const { count } = await getSupabaseAdmin()
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("clipper_id", me.id)
      .is("read_at", null);
    unread = count ?? 0;
  }
  return ok({ me, unread });
}
