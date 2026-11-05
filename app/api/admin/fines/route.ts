import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { canAccessCampaign, fail, guard, ok, parseBody, staffCampaignIds } from "@/lib/portal/guard";
import { formatINR, rupeesToPaise } from "@/lib/portal/money";
import { audit, can } from "@/lib/portal/session";
import {
  canUseNoticesPage,
  getActiveClipper,
  getCampaign,
  isCampaignMember,
  nameMaps,
  rupeeAmount,
  scopeFilter,
} from "@/app/admin/rejections/server";

export const dynamic = "force-dynamic";

// GET /api/admin/fines?campaign=&clipper=&status=active|waived
// Fines in campaigns the caller can access; campaign-less fines only for fines.create holders.
export async function GET(req: Request) {
  const g = await guard({ staff: true });
  if ("error" in g) return g.error;
  const { me } = g;
  if (!canUseNoticesPage(me)) return fail(403, "You don't have permission to do that.");

  const url = new URL(req.url);
  const campaign = url.searchParams.get("campaign") || "";
  const clipper = url.searchParams.get("clipper") || "";
  const status = url.searchParams.get("status") || "";
  const uuid = z.uuid();
  if (campaign && !uuid.safeParse(campaign).success) return fail(400, "Unknown campaign.");
  if (clipper && !uuid.safeParse(clipper).success) return fail(400, "Unknown clipper.");

  const ids = await staffCampaignIds(me);
  const scope = scopeFilter(ids, can(me, "fines.create") ? "campaign_id.is.null" : false);
  if (scope === null) return ok({ fines: [] });
  if (campaign && ids !== null && !ids.includes(campaign)) return ok({ fines: [] });

  let q = getSupabaseAdmin()
    .from("fines")
    .select("id, clipper_id, campaign_id, amount_paise, reason, reel_ref, created_by, created_at, waived_by, waived_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (scope) q = q.or(scope);
  if (campaign) q = q.eq("campaign_id", campaign);
  if (clipper) q = q.eq("clipper_id", clipper);
  if (status === "active") q = q.is("waived_at", null);
  if (status === "waived") q = q.not("waived_at", "is", null);
  const { data, error } = await q;
  if (error) {
    console.error("[fines] list failed", error);
    return fail(500, "Couldn't load fines.");
  }

  type Row = {
    id: string;
    clipper_id: string;
    campaign_id: string | null;
    amount_paise: number;
    reason: string;
    reel_ref: string | null;
    created_by: string;
    created_at: string;
    waived_by: string | null;
    waived_at: string | null;
  };
  const rows = (data ?? []) as Row[];
  const { people, campaigns } = await nameMaps(
    rows.flatMap((r) => [r.clipper_id, r.created_by, r.waived_by]),
    rows.map((r) => r.campaign_id),
  );
  return ok({
    fines: rows.map((r) => ({
      id: r.id,
      clipperId: r.clipper_id,
      clipperName: people.get(r.clipper_id)?.name ?? "Unknown clipper",
      clipperLogin: people.get(r.clipper_id)?.loginId ?? "",
      campaignId: r.campaign_id,
      campaignName: r.campaign_id ? campaigns.get(r.campaign_id) ?? "Deleted campaign" : null,
      amountPaise: Number(r.amount_paise),
      reason: r.reason,
      reelRef: r.reel_ref,
      createdAt: r.created_at,
      createdByName: people.get(r.created_by)?.name ?? "Staff",
      waivedAt: r.waived_at,
      waivedByName: r.waived_by ? people.get(r.waived_by)?.name ?? "Super admin" : null,
    })),
  });
}

const fineSchema = z.object({
  clipperId: z.uuid("Pick a clipper"),
  campaignId: z.uuid("Pick a campaign").optional().nullable(),
  amount: rupeeAmount,
  reason: z.string().trim().min(3, "Tell the clipper why").max(1000, "Keep it under 1000 characters"),
  reelRef: z.string().trim().max(500, "Keep it under 500 characters").optional().nullable(),
});

// POST /api/admin/fines — "fine only": add a fine (no reel rejection) and tell the clipper.
export async function POST(req: Request) {
  const g = await guard({ permission: "fines.create" });
  if ("error" in g) return g.error;
  const { me } = g;
  const p = await parseBody(req, fineSchema);
  if ("error" in p) return p.error;
  const d = p.data;

  const clipper = await getActiveClipper(d.clipperId);
  if (!clipper) return fail(404, "That clipper isn't active.", { clipperId: "Not an active clipper" });

  let campaign: { id: string; name: string } | null = null;
  if (d.campaignId) {
    if (!(await canAccessCampaign(me, d.campaignId))) return fail(403, "You're not assigned to that campaign.");
    campaign = await getCampaign(d.campaignId);
    if (!campaign) return fail(404, "That campaign no longer exists.");
    if (!(await isCampaignMember(d.campaignId, d.clipperId)))
      return fail(400, "That clipper isn't in this campaign.", { clipperId: "Not in this campaign" });
  }

  const amountPaise = rupeesToPaise(d.amount);
  const reelRef = d.reelRef || null;
  const sb = getSupabaseAdmin();
  const { data: fine, error } = await sb
    .from("fines")
    .insert({
      clipper_id: d.clipperId,
      campaign_id: campaign?.id ?? null,
      amount_paise: amountPaise,
      reason: d.reason,
      reel_ref: reelRef,
      created_by: me.id,
    })
    .select("id")
    .single();
  if (error || !fine) {
    console.error("[fines] insert failed", error);
    return fail(500, "Couldn't save the fine.");
  }

  const { error: nErr } = await sb.from("notifications").insert({
    clipper_id: d.clipperId,
    kind: "fine",
    title: campaign ? `Fine — ${campaign.name}` : "Fine added to your account",
    body: `${d.reason}\n\nFine: ${formatINR(amountPaise)}. It will be deducted from your earnings.`,
    reel_ref: reelRef,
    campaign_id: campaign?.id ?? null,
    created_by: me.id,
  });
  if (nErr) {
    console.error("[fines] notification insert failed", nErr);
    await sb.from("fines").delete().eq("id", fine.id);
    return fail(500, "Couldn't notify the clipper, so the fine wasn't added. Please try again.");
  }

  await audit(me.id, "FINE_ADDED", "fine", fine.id, null, {
    clipperId: d.clipperId,
    campaignId: campaign?.id ?? null,
    amountPaise,
    reason: d.reason,
    reelRef,
  });
  return ok({ id: fine.id });
}
