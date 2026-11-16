import { getSupabaseAdmin } from "@/lib/supabase";
import { guard, ok } from "@/lib/portal/guard";
import { loadActivity } from "@/routes/api/admin/activity/load";

// GET /api/pages/admin/activity — first page of the activity log plus the people list for the filter.
export async function GET() {
  const g = await guard({ permission: "audit.view" });
  if ("error" in g) return g.error;

  let initial: Awaited<ReturnType<typeof loadActivity>> | null = null;
  try {
    initial = await loadActivity({});
  } catch (e) {
    console.error("[activity] page load failed", e);
  }
  const { data: people } = await getSupabaseAdmin()
    .from("profiles")
    .select("id, full_name, login_id, role")
    .order("role")
    .order("full_name")
    .limit(2000);
  return ok({ initial, people: people ?? [] });
}
