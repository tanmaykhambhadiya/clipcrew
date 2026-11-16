import { guard, ok } from "@/lib/portal/guard";
import { can } from "@/lib/portal/session";
import { loadFormData } from "@/loaders/rejections";

// GET /api/pages/admin/rejections — dropdown data for the notices screen.
export async function GET() {
  const g = await guard({ staff: true });
  if ("error" in g) return g.error;
  const { me } = g;
  if (!(can(me, "rejections.send") || can(me, "fines.create") || can(me, "campaigns.manage"))) {
    return Response.json({ ok: false, error: "You don't have permission to do that." }, { status: 403 });
  }
  return ok(await loadFormData(me));
}
