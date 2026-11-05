import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fail, guard, ok, parseBody } from "@/lib/portal/guard";
import { formatINR } from "@/lib/portal/money";
import { audit } from "@/lib/portal/session";
import { getCampaign } from "@/app/admin/rejections/server";

const schema = z.object({
  note: z.string().trim().max(500, "Keep the note under 500 characters").optional().nullable(),
});

// POST /api/admin/fines/:id/waive — super admin only. Marks the fine waived and tells the clipper.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await guard({ superAdmin: true });
  if ("error" in g) return g.error;
  const { me } = g;
  if (!z.uuid().safeParse(params.id).success) return fail(404, "Fine not found.");
  const p = await parseBody(req, schema);
  if ("error" in p) return p.error;
  const note = p.data.note || null;

  const sb = getSupabaseAdmin();
  const { data: before } = await sb
    .from("fines")
    .select("id, clipper_id, campaign_id, amount_paise, reason, reel_ref, waived_at, waived_by")
    .eq("id", params.id)
    .maybeSingle();
  if (!before) return fail(404, "Fine not found.");
  if (before.waived_at) return fail(409, "This fine is already waived.");

  const waivedAt = new Date().toISOString();
  const { data: updated, error } = await sb
    .from("fines")
    .update({ waived_by: me.id, waived_at: waivedAt })
    .eq("id", params.id)
    .is("waived_at", null) // no double-waive if two tabs click at once
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[fines] waive failed", error);
    return fail(500, "Couldn't waive the fine.");
  }
  if (!updated) return fail(409, "This fine is already waived.");

  const campaign = before.campaign_id ? await getCampaign(before.campaign_id) : null;
  const amount = formatINR(before.amount_paise);
  const { error: nErr } = await sb.from("notifications").insert({
    clipper_id: before.clipper_id,
    kind: "fine",
    title: "Fine waived",
    body: [`Your fine of ${amount}${campaign ? ` on ${campaign.name}` : ""} has been waived and won't be deducted.`, note ? `\nNote: ${note}` : null]
      .filter(Boolean)
      .join("\n"),
    reel_ref: before.reel_ref,
    campaign_id: before.campaign_id,
    created_by: me.id,
  });
  if (nErr) console.error("[fines] waive notification failed", nErr);

  await audit(me.id, "FINE_WAIVED", "fine", before.id, before, { ...before, waived_by: me.id, waived_at: waivedAt, note });
  return ok({ id: before.id, waivedAt });
}
