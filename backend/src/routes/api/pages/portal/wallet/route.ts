import { getSupabaseAdmin } from "@/lib/supabase";
import { guard, ok } from "@/lib/portal/guard";
import { loadEarningsPayload } from "@/loaders/earnings";

// GET /api/pages/portal/wallet — earnings payload plus the clipper's UPI ID, payouts and fines.
export async function GET() {
  const g = await guard({ clipper: true });
  if ("error" in g) return g.error;
  const { me } = g;
  const db = getSupabaseAdmin();

  const [earnings, profileRes, payoutsRes, finesRes] = await Promise.all([
    loadEarningsPayload(me.id),
    db.from("profiles").select("upi_id").eq("id", me.id).maybeSingle(),
    db.from("payouts").select("id, amount_paise, paid_on, reference, note").eq("clipper_id", me.id).order("paid_on", { ascending: false }).order("created_at", { ascending: false }),
    db.from("fines").select("id, amount_paise, reason, reel_ref, campaign_id, created_at, waived_at").eq("clipper_id", me.id).order("created_at", { ascending: false }),
  ]);
  const fines = finesRes.data ?? [];

  // Campaign names for fines (a fine may point at a campaign the clipper has since left).
  const campaignNames: Record<string, string> = Object.fromEntries(earnings.campaigns.map((c) => [c.id, c.name]));
  const missing = Array.from(new Set(fines.map((f: any) => f.campaign_id).filter((id: string | null): id is string => !!id && !(id in campaignNames))));
  if (missing.length) {
    const { data } = await db.from("campaigns").select("id, name").in("id", missing);
    for (const c of data ?? []) campaignNames[c.id] = c.name;
  }

  return ok({
    ...earnings,
    upi: (profileRes.data?.upi_id as string | null | undefined) ?? null,
    payouts: payoutsRes.data ?? [],
    fines,
    campaignNames,
    loadError: !!(payoutsRes.error || finesRes.error),
  });
}
