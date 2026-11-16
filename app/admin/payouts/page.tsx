import { redirect } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";
import { pageApi } from "@/lib/server-api";
import { can, getMe } from "@/lib/portal/session";
import { istToday } from "@/lib/portal/weeks";
import { PageTitle } from "@/components/portal/ui";
import { PayoutsManager, type ClipperBalanceRow, type PayoutRow } from "./PayoutsManager";

export const dynamic = "force-dynamic";

export default async function PayoutsPage() {
  const me = await getMe();
  if (!me || !can(me, "payouts.manage")) redirect("/admin");

  const { clippers, payouts, historyCapped, loadError } = await pageApi<{
    clippers: ClipperBalanceRow[];
    payouts: PayoutRow[];
    historyCapped: boolean;
    loadError: string;
  }>("/api/pages/admin/payouts");

  return (
    <div className="space-y-10">
      <PageTitle eyebrow="Payouts" line1="Pay your crew" line2="balances, payouts & history.">
        {can(me, "export.data") && (
          <a
            href={apiUrl("/api/admin/export?type=payouts")}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm text-muted-dark transition hover:border-lime hover:text-lime"
          >
            Download CSV
          </a>
        )}
      </PageTitle>
      <PayoutsManager
        clippers={clippers}
        payouts={payouts}
        historyCapped={historyCapped}
        isSuper={me.role === "super_admin"}
        today={istToday()}
        loadError={loadError}
      />
    </div>
  );
}
