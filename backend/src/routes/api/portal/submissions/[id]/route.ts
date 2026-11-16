import { getSupabaseAdmin } from "@/lib/supabase";
import { fail, guard, ok } from "@/lib/portal/guard";

// DELETE /api/portal/submissions/:id — a clipper withdraws one of their own submissions, only while it's still pending.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await guard({ clipper: true });
  if ("error" in g) return g.error;
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return fail(404, "Submission not found.");

  const { data: s } = await getSupabaseAdmin().from("submissions").select("id, status").eq("id", params.id).eq("clipper_id", g.me.id).maybeSingle();
  if (!s) return fail(404, "Submission not found.");
  if (s.status !== "pending") return fail(409, "Only submissions still waiting for review can be withdrawn.");

  const { error } = await getSupabaseAdmin().from("submissions").delete().eq("id", s.id).eq("clipper_id", g.me.id).eq("status", "pending");
  if (error) return fail(500, "Couldn't withdraw the submission.");
  return ok();
}
