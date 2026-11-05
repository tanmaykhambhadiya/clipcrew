import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";
import { can, getMe } from "@/lib/portal/session";
import { istToday } from "@/lib/portal/weeks";
import { PageTitle } from "@/components/portal/ui";
import { PayoutsManager, type ClipperBalanceRow, type PayoutRow } from "./PayoutsManager";

export const dynamic = "force-dynamic";

const HISTORY_LIMIT = 500;

export default async function PayoutsPage() {
  const me = await getMe();
  if (!me || !can(me, "payouts.manage")) redirect("/admin");

  const db = getSupabaseAdmin();
  const [profilesRes, balancesRes, payoutsRes] = await Promise.all([
    db.from("profiles").select("id, full_name, login_id, upi_id, status").eq("role", "clipper"),
    db.from("clipper_balances").select("clipper_id, earned_paise, fines_paise, paid_paise"),
    db
      .from("payouts")
      .select("id, clipper_id, amount_paise, paid_on, reference, note, created_by, created_at")
      .order("paid_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);

  const loadError = profilesRes.error || balancesRes.error || payoutsRes.error ? "Some payout data couldn't load. Refresh to try again." : "";
  const profiles = profilesRes.data ?? [];
  const balances = new Map((balancesRes.data ?? []).map((b) => [b.clipper_id as string, b]));

  const clippers: ClipperBalanceRow[] = profiles
    .filter((p) => p.status === "active")
    .map((p) => {
      const b = balances.get(p.id);
      const earned = Number(b?.earned_paise ?? 0);
      const fines = Number(b?.fines_paise ?? 0);
      const paid = Number(b?.paid_paise ?? 0);
      return {
        id: p.id,
        name: p.full_name,
        loginId: p.login_id,
        upiId: p.upi_id,
        earnedPaise: earned,
        finesPaise: fines,
        paidPaise: paid,
        balancePaise: earned - fines - paid,
      };
    });

  // Names for the history: clippers (incl. terminated) and the staff who recorded each payout.
  const names = new Map(profiles.map((p) => [p.id as string, { name: p.full_name as string, loginId: p.login_id as string }]));
  const staffIds = Array.from(new Set((payoutsRes.data ?? []).map((p) => p.created_by as string).filter((id) => !names.has(id))));
  if (staffIds.length) {
    const { data } = await db.from("profiles").select("id, full_name, login_id").in("id", staffIds);
    for (const s of data ?? []) names.set(s.id, { name: s.full_name, loginId: s.login_id });
  }

  const payouts: PayoutRow[] = (payoutsRes.data ?? []).map((p) => ({
    id: p.id,
    clipperId: p.clipper_id,
    clipperName: names.get(p.clipper_id)?.name ?? "Unknown clipper",
    clipperLoginId: names.get(p.clipper_id)?.loginId ?? "",
    amountPaise: Number(p.amount_paise),
    paidOn: p.paid_on,
    reference: p.reference,
    note: p.note,
    createdByName: names.get(p.created_by)?.name ?? "—",
  }));

  return (
    <div className="space-y-10">
      <PageTitle eyebrow="Payouts" line1="Pay your crew" line2="balances, payouts & history.">
        {can(me, "export.data") && (
          <a
            href="/api/admin/export?type=payouts"
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm text-muted-dark transition hover:border-lime hover:text-lime"
          >
            Download CSV
          </a>
        )}
      </PageTitle>
      <PayoutsManager
        clippers={clippers}
        payouts={payouts}
        historyCapped={payouts.length >= HISTORY_LIMIT}
        isSuper={me.role === "super_admin"}
        today={istToday()}
        loadError={loadError}
      />
    </div>
  );
}
