import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";
import { can, getMe } from "@/lib/portal/session";
import { PageTitle } from "@/components/portal/ui";
import { loadActivity } from "@/app/api/admin/activity/load";
import { ActivityLog } from "./ActivityLog";
import { ACTION_LABELS } from "./labels";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const me = await getMe();
  if (!me || !can(me, "audit.view")) redirect("/admin");

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

  const actions = Array.from(new Set([...Object.keys(ACTION_LABELS), ...(initial?.entries.map((e) => e.action) ?? [])])).sort();

  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Activity" line1="Who did what," line2="and when." />
      <p className="max-w-2xl text-muted-dark">
        Every change made in the portal is recorded here — newest first. Expand an entry to see exactly what changed.
      </p>
      <ActivityLog
        initial={initial}
        actions={actions}
        actors={(people ?? []).map((p) => ({ id: p.id, name: p.full_name, loginId: p.login_id, role: p.role }))}
      />
    </div>
  );
}
