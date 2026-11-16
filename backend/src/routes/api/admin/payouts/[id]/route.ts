import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fail, guard, notify, ok } from "@/lib/portal/guard";
import { audit } from "@/lib/portal/session";
import { formatINR } from "@/lib/portal/money";
import { formatDate } from "@/lib/portal/weeks";

// DELETE /api/admin/payouts/:id — super admin only: remove a payout entered by mistake.
// The amount goes back onto the clipper's balance; the clipper gets an inbox note so nothing changes silently.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await guard({ superAdmin: true });
  if ("error" in g) return g.error;
  const { me } = g;

  if (!z.uuid().safeParse(params.id).success) return fail(404, "That payout doesn't exist.");

  const db = getSupabaseAdmin();
  const { data: before } = await db
    .from("payouts")
    .select("id, clipper_id, amount_paise, paid_on, reference, note, created_by, created_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!before) return fail(404, "That payout was already removed.");

  const { error } = await db.from("payouts").delete().eq("id", params.id);
  if (error) {
    console.error("[payouts] delete failed", error);
    return fail(500, "Couldn't remove the payout.");
  }

  await Promise.all([
    audit(me.id, "PAYOUT_DELETED", "payout", params.id, before, null),
    notify(before.clipper_id, {
      kind: "info",
      title: `Payout record of ${formatINR(before.amount_paise)} removed`,
      body: `The payout dated ${formatDate(before.paid_on)} was recorded by mistake and has been removed. Your balance has been updated.`,
      createdBy: me.id,
    }),
  ]);

  return ok();
}
