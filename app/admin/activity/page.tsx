import { redirect } from "next/navigation";
import { pageApi } from "@/lib/server-api";
import { can, getMe } from "@/lib/portal/session";
import { PageTitle } from "@/components/portal/ui";
import type { ActivityEntry } from "@/lib/portal/types";
import { ActivityLog } from "./ActivityLog";
import { ACTION_LABELS } from "./labels";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const me = await getMe();
  if (!me || !can(me, "audit.view")) redirect("/admin");

  const { initial, people } = await pageApi<{
    initial: { entries: ActivityEntry[]; hasMore: boolean; nextOffset: number } | null;
    people: { id: string; full_name: string; login_id: string; role: string }[];
  }>("/api/pages/admin/activity");

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
