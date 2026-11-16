import { getSupabaseAdmin } from "@/lib/supabase";
import { guard, ok } from "@/lib/portal/guard";

const HISTORY_LIMIT = 500;

// GET /api/pages/admin/payouts — everything the payouts screen shows.
export async function GET() {
  const g = await guard({ permission: "payouts.manage" });
  if ("error" in g) return g.error;

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
  const balances = new Map<string, any>((balancesRes.data ?? []).map((b: any) => [b.clipper_id as string, b]));

  const clippers = profiles
    .filter((p: any) => p.status === "active")
    .map((p: any) => {
      const b = balances.get(p.id);
      const earned = Number(b?.earned_paise ?? 0);
      const fines = Number(b?.fines_paise ?? 0);
      const paid = Number(b?.paid_paise ?? 0);
      return { id: p.id, name: p.full_name, loginId: p.login_id, upiId: p.upi_id, earnedPaise: earned, finesPaise: fines, paidPaise: paid, balancePaise: earned - fines - paid };
    });

  // Names for the history: clippers (incl. terminated) and the staff who recorded each payout.
  const names = new Map<string, { name: string; loginId: string }>(profiles.map((p: any) => [p.id as string, { name: p.full_name as string, loginId: p.login_id as string }]));
  const staffIds = Array.from(new Set<string>((payoutsRes.data ?? []).map((p: any) => p.created_by as string).filter((id: string) => !names.has(id))));
  if (staffIds.length) {
    const { data } = await db.from("profiles").select("id, full_name, login_id").in("id", staffIds);
    for (const s of data ?? []) names.set(s.id, { name: s.full_name, loginId: s.login_id });
  }

  const payouts = (payoutsRes.data ?? []).map((p: any) => ({
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

  return ok({ clippers, payouts, historyCapped: payouts.length >= HISTORY_LIMIT, loadError });
}
