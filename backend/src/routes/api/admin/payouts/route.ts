import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fail, guard, notify, ok, parseBody } from "@/lib/portal/guard";
import { audit } from "@/lib/portal/session";
import { formatINR, rupeesToPaise } from "@/lib/portal/money";
import { formatDate, istToday } from "@/lib/portal/weeks";

const MAX_LIST = 500;

// GET /api/admin/payouts?clipperId=… — recent payouts (newest first), optionally for one clipper.
export async function GET(req: Request) {
  const g = await guard({ permission: "payouts.manage" });
  if ("error" in g) return g.error;

  const clipperId = new URL(req.url).searchParams.get("clipperId");
  if (clipperId && !z.uuid().safeParse(clipperId).success) return fail(400, "Unknown clipper.");

  let q = getSupabaseAdmin()
    .from("payouts")
    .select("id, clipper_id, amount_paise, paid_on, reference, note, created_by, created_at")
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(MAX_LIST);
  if (clipperId) q = q.eq("clipper_id", clipperId);
  const { data, error } = await q;
  if (error) return fail(500, "Couldn't load payouts.");
  return ok({ payouts: data });
}

const recordSchema = z.object({
  clipperId: z.uuid("Pick a clipper"),
  amount: z
    .number({ error: "Enter an amount" })
    .positive("Amount must be more than ₹0")
    .max(10_000_000, "That's too large")
    .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "Use at most 2 decimal places"),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  reference: z.string().trim().max(120, "Keep it under 120 characters").optional(),
  note: z.string().trim().max(500, "Keep it under 500 characters").optional(),
});

// POST /api/admin/payouts — record money sent to a clipper. Amount must be > 0 and ≤ their balance.
export async function POST(req: Request) {
  const g = await guard({ permission: "payouts.manage" });
  if ("error" in g) return g.error;
  const { me } = g;

  const body = await parseBody(req, recordSchema);
  if ("error" in body) return body.error;
  const d = body.data;

  const today = istToday();
  const parsedDate = new Date(`${d.paidOn}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== d.paidOn) {
    return fail(400, "Pick a valid date.", { paidOn: "Pick a valid date" });
  }
  if (d.paidOn > today) return fail(400, "The payout date can't be in the future.", { paidOn: "Can't be in the future" });
  if (d.paidOn < "2020-01-01") return fail(400, "That date looks wrong.", { paidOn: "That date looks wrong" });

  const db = getSupabaseAdmin();
  const { data: clipper } = await db.from("profiles").select("id, full_name, login_id, role, status").eq("id", d.clipperId).maybeSingle();
  if (!clipper || clipper.role !== "clipper") return fail(404, "That clipper doesn't exist.", { clipperId: "Unknown clipper" });
  if (clipper.status !== "active") return fail(400, "That clipper's account is terminated.");

  const { data: bal, error: balErr } = await db
    .from("clipper_balances")
    .select("earned_paise, fines_paise, paid_paise")
    .eq("clipper_id", d.clipperId)
    .maybeSingle();
  if (balErr) return fail(500, "Couldn't check the balance. Try again.");
  const balance = Number(bal?.earned_paise ?? 0) - Number(bal?.fines_paise ?? 0) - Number(bal?.paid_paise ?? 0);

  const amountPaise = rupeesToPaise(d.amount);
  if (amountPaise <= 0) return fail(400, "Amount must be more than ₹0.", { amount: "Must be more than ₹0" });
  if (balance <= 0) return fail(400, `${clipper.full_name} has nothing to pay out right now.`, { amount: "Balance is " + formatINR(balance) });
  if (amountPaise > balance) {
    return fail(400, `That's more than the balance of ${formatINR(balance)}.`, { amount: `Max ${formatINR(balance)}` });
  }

  const row = {
    clipper_id: d.clipperId,
    amount_paise: amountPaise,
    paid_on: d.paidOn,
    reference: d.reference || null,
    note: d.note || null,
    created_by: me.id,
  };
  const { data: created, error } = await db.from("payouts").insert(row).select("id").single();
  if (error || !created) {
    console.error("[payouts] insert failed", error);
    return fail(500, "Couldn't save the payout.");
  }

  await Promise.all([
    notify(d.clipperId, {
      kind: "payout",
      title: `${formatINR(amountPaise)} paid${d.reference ? ` — ref ${d.reference}` : ""}`,
      body: d.note ? d.note : `Sent on ${formatDate(d.paidOn)}. Check your wallet for details.`,
      createdBy: me.id,
    }),
    audit(me.id, "PAYOUT_RECORDED", "payout", created.id, null, { ...row, balance_before_paise: balance }),
  ]);

  return ok({ payout: { id: created.id }, balancePaise: balance - amountPaise });
}
