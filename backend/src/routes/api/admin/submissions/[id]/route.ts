import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { canAccessCampaign, fail, guard, notify, ok, parseBody } from "@/lib/portal/guard";
import { audit, can } from "@/lib/portal/session";
import { formatINR, rupeesToPaise } from "@/lib/portal/money";
import { rupeeAmount } from "@/loaders/rejections";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({
    action: z.literal("reject"),
    reason: z.string().trim().min(3, "Tell the clipper why.").max(1000, "Keep it under 1000 characters."),
    fine: rupeeAmount.optional().nullable(),
  }),
]);

// PATCH /api/admin/submissions/:id — approve a pending submission, or reject a pending/approved one
// (reason required; an optional fine; the clipper gets a "reel rejected" notice in their inbox).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await guard({ permission: "submissions.review" });
  if ("error" in g) return g.error;
  const { me } = g;
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return fail(404, "Submission not found.");
  const body = await parseBody(req, schema);
  if ("error" in body) return body.error;
  const d = body.data;

  const sb = getSupabaseAdmin();
  const { data: s } = await sb.from("submissions").select("id, clipper_id, campaign_id, url, status").eq("id", params.id).maybeSingle();
  if (!s) return fail(404, "Submission not found.");
  if (!(await canAccessCampaign(me, s.campaign_id))) return fail(403, "You're not assigned to that campaign.");
  const now = new Date().toISOString();

  if (d.action === "approve") {
    if (s.status !== "pending") return fail(409, "This submission was already reviewed. Refresh the page.");
    const { data: upd, error } = await sb
      .from("submissions")
      .update({ status: "approved", reviewed_by: me.id, reviewed_at: now, reject_reason: null })
      .eq("id", s.id)
      .eq("status", "pending")
      .select("id");
    if (error) return fail(500, "Couldn't approve the submission.");
    if (!upd?.length) return fail(409, "Someone else just reviewed this. Refresh the page.");
    await audit(me.id, "SUBMISSION_APPROVED", "submission", s.id, { status: "pending" }, { status: "approved", url: s.url });
    return ok();
  }

  // reject
  if (s.status === "rejected") return fail(409, "This submission was already rejected.");
  if (d.fine && !can(me, "fines.create")) return fail(403, "You can't add fines — reject without one.", { fine: "Not allowed" });
  const finePaise = d.fine ? rupeesToPaise(d.fine) : 0;
  const { data: campaign } = await sb.from("campaigns").select("name").eq("id", s.campaign_id).maybeSingle();

  let fineId: string | null = null;
  if (finePaise > 0) {
    const { data: fine, error } = await sb
      .from("fines")
      .insert({ clipper_id: s.clipper_id, campaign_id: s.campaign_id, amount_paise: finePaise, reason: d.reason, reel_ref: s.url, created_by: me.id })
      .select("id")
      .single();
    if (error || !fine) return fail(500, "Couldn't save the fine. Nothing was changed.");
    fineId = fine.id;
  }

  const { data: upd, error: uErr } = await sb
    .from("submissions")
    .update({ status: "rejected", reviewed_by: me.id, reviewed_at: now, reject_reason: d.reason, fine_id: fineId })
    .eq("id", s.id)
    .eq("status", s.status)
    .select("id");
  if (uErr || !upd?.length) {
    if (fineId) await sb.from("fines").delete().eq("id", fineId); // keep it all-or-nothing
    return fail(uErr ? 500 : 409, uErr ? "Couldn't reject the submission." : "Someone else just reviewed this. Refresh the page.");
  }

  await notify(s.clipper_id, {
    kind: "reel_rejected",
    title: `Reel rejected — ${campaign?.name ?? "campaign"}`,
    body: [d.reason, "", "Views on this reel won't be counted.", finePaise > 0 ? `Fine: ${formatINR(finePaise)}` : null].filter((x) => x !== null).join("\n"),
    reelRef: s.url,
    campaignId: s.campaign_id,
    createdBy: me.id,
  });
  await audit(me.id, "SUBMISSION_REJECTED", "submission", s.id, { status: s.status }, { status: "rejected", url: s.url, reason: d.reason, finePaise: finePaise || null });
  if (fineId) await audit(me.id, "FINE_ADDED", "fine", fineId, null, { clipperId: s.clipper_id, campaignId: s.campaign_id, amountPaise: finePaise, reason: d.reason });
  return ok();
}
