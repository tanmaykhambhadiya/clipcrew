import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getMe } from "@/lib/portal/session";
import { PageTitle } from "@/components/portal/ui";
import { AccountsManager, type ClipperAccount } from "./AccountsManager";

export const dynamic = "force-dynamic";

export default async function PortalAccountsPage() {
  const me = await getMe();
  if (!me || me.role !== "clipper") redirect("/login");

  const supabase = getSupabaseAdmin();
  const { data: rows } = await supabase
    .from("social_accounts")
    .select("id, platform, username, verify_code, status, verified_at, created_at")
    .eq("clipper_id", me.id)
    .order("created_at", { ascending: false });
  const accounts = rows ?? [];

  // Latest rejection reason per rejected account (the reason lives in the audit trail).
  const rejectedIds = accounts.filter((a) => a.status === "rejected").map((a) => a.id);
  const reasons: Record<string, string> = {};
  if (rejectedIds.length) {
    const { data: logs } = await supabase
      .from("audit_log")
      .select("entity_id, action, after, created_at")
      .eq("entity", "social_account")
      .in("entity_id", rejectedIds)
      .in("action", ["ACCOUNT_REJECTED", "ACCOUNT_REVOKED"])
      .order("created_at", { ascending: false });
    for (const l of logs ?? []) {
      const reason = (l.after as { reason?: string } | null)?.reason;
      if (l.entity_id && reason && !reasons[l.entity_id]) reasons[l.entity_id] = reason;
    }
  }

  const list: ClipperAccount[] = accounts.map((a) => ({ ...a, reason: reasons[a.id] ?? null }));

  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Accounts" line1="Your accounts" line2="verified & ready to earn." />
      <AccountsManager accounts={list} />
    </div>
  );
}
