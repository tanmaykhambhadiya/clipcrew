import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { canAccessCampaign, fail, guard, ok, parseBody, staffCampaignIds } from "@/lib/portal/guard";
import { formatINR, rupeesToPaise } from "@/lib/portal/money";
import { audit, can } from "@/lib/portal/session";
import {
  canUseNoticesPage,
  getActiveClipper,
  getCampaign,
  httpUrl,
  isCampaignMember,
  nameMaps,
  rupeeAmount,
  scopeFilter,
} from "@/app/admin/rejections/server";

export const dynamic = "force-dynamic";

const KINDS = ["reel_rejected", "fine", "info"] as const;

// GET /api/admin/rejections?campaign=&clipper=&type=reel_rejected|fine|info
// Recent notices staff have sent (rejections, fine notices, announcements), scoped to campaigns the
// caller can access. Campaign-less fine notices are visible to fines.create holders. Announcements
// sent to many clippers at once are grouped into one row.
export async function GET(req: Request) {
  const g = await guard({ staff: true });
  if ("error" in g) return g.error;
  const { me } = g;
  if (!canUseNoticesPage(me)) return fail(403, "You don't have permission to do that.");

  const url = new URL(req.url);
  const campaign = url.searchParams.get("campaign") || "";
  const clipper = url.searchParams.get("clipper") || "";
  const type = url.searchParams.get("type") || "";
  const uuid = z.uuid();
  if (campaign && !uuid.safeParse(campaign).success) return fail(400, "Unknown campaign.");
  if (clipper && !uuid.safeParse(clipper).success) return fail(400, "Unknown clipper.");
  if (type && !(KINDS as readonly string[]).includes(type)) return fail(400, "Unknown type.");

  const ids = await staffCampaignIds(me);
  const scope = scopeFilter(ids, can(me, "fines.create") ? "and(campaign_id.is.null,kind.eq.fine)" : false);
  if (scope === null) return ok({ items: [] });
  if (campaign && ids !== null && !ids.includes(campaign)) return ok({ items: [] });

  let q = getSupabaseAdmin()
    .from("notifications")
    .select("id, clipper_id, kind, title, body, reel_ref, campaign_id, created_by, created_at, read_at")
    .not("created_by", "is", null)
    .in("kind", type ? [type] : [...KINDS])
    .order("created_at", { ascending: false })
    .limit(400);
  if (scope) q = q.or(scope);
  if (campaign) q = q.eq("campaign_id", campaign);
  if (clipper) q = q.eq("clipper_id", clipper);
  const { data, error } = await q;
  if (error) {
    console.error("[rejections] history failed", error);
    return fail(500, "Couldn't load the history.");
  }

  type Row = {
    id: string;
    clipper_id: string;
    kind: string;
    title: string;
    body: string | null;
    reel_ref: string | null;
    campaign_id: string | null;
    created_by: string | null;
    created_at: string;
    read_at: string | null;
  };
  const rows = (data ?? []) as Row[];

  // Group announcements sent in one go (same sender, same instant, same title).
  type Item = Row & { recipients: number; readCount: number };
  const items: Item[] = [];
  const groups = new Map<string, Item>();
  for (const r of rows) {
    if (r.kind === "info" && !clipper) {
      const key = `${r.created_by}|${r.created_at}|${r.title}|${r.campaign_id}`;
      const existing = groups.get(key);
      if (existing) {
        existing.recipients += 1;
        if (r.read_at) existing.readCount += 1;
        continue;
      }
      const item = { ...r, recipients: 1, readCount: r.read_at ? 1 : 0 };
      groups.set(key, item);
      items.push(item);
    } else {
      items.push({ ...r, recipients: 1, readCount: r.read_at ? 1 : 0 });
    }
  }
  const top = items.slice(0, 150);

  const { people, campaigns } = await nameMaps(
    top.flatMap((r) => [r.clipper_id, r.created_by]),
    top.map((r) => r.campaign_id),
  );
  return ok({
    items: top.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      reelRef: r.reel_ref,
      campaignId: r.campaign_id,
      campaignName: r.campaign_id ? campaigns.get(r.campaign_id) ?? "Deleted campaign" : null,
      clipperId: r.clipper_id,
      clipperName: people.get(r.clipper_id)?.name ?? "Unknown clipper",
      recipients: r.recipients,
      readCount: r.readCount,
      createdAt: r.created_at,
      createdByName: r.created_by ? people.get(r.created_by)?.name ?? "Staff" : "System",
    })),
  });
}

const rejectSchema = z.object({
  campaignId: z.uuid("Pick a campaign"),
  clipperId: z.uuid("Pick a clipper"),
  reelUrl: httpUrl,
  reason: z.string().trim().min(3, "Tell the clipper why").max(1000, "Keep it under 1000 characters"),
  fine: rupeeAmount.optional().nullable(),
});

// POST /api/admin/rejections — send a "reel rejected" notice (optionally with a fine).
export async function POST(req: Request) {
  const g = await guard({ permission: "rejections.send" });
  if ("error" in g) return g.error;
  const { me } = g;
  const p = await parseBody(req, rejectSchema);
  if ("error" in p) return p.error;
  const d = p.data;

  if (d.fine && !can(me, "fines.create")) return fail(403, "You can't add fines — send the notice without one.", { fine: "Not allowed" });
  if (!(await canAccessCampaign(me, d.campaignId))) return fail(403, "You're not assigned to that campaign.");
  const campaign = await getCampaign(d.campaignId);
  if (!campaign) return fail(404, "That campaign no longer exists.");
  const clipper = await getActiveClipper(d.clipperId);
  if (!clipper) return fail(404, "That clipper isn't active.", { clipperId: "Not an active clipper" });
  if (!(await isCampaignMember(d.campaignId, d.clipperId)))
    return fail(400, "That clipper isn't in this campaign.", { clipperId: "Not in this campaign" });

  const sb = getSupabaseAdmin();
  const finePaise = d.fine ? rupeesToPaise(d.fine) : 0;

  let fineId: string | null = null;
  if (finePaise > 0) {
    const { data: fine, error } = await sb
      .from("fines")
      .insert({
        clipper_id: d.clipperId,
        campaign_id: d.campaignId,
        amount_paise: finePaise,
        reason: d.reason,
        reel_ref: d.reelUrl,
        created_by: me.id,
      })
      .select("id")
      .single();
    if (error || !fine) {
      console.error("[rejections] fine insert failed", error);
      return fail(500, "Couldn't save the fine. Nothing was sent.");
    }
    fineId = fine.id;
  }

  const body = [d.reason, "", "Views on this reel won't be counted.", finePaise > 0 ? `Fine: ${formatINR(finePaise)}` : null]
    .filter((x) => x !== null)
    .join("\n");
  const { data: note, error: nErr } = await sb
    .from("notifications")
    .insert({
      clipper_id: d.clipperId,
      kind: "reel_rejected",
      title: `Reel rejected — ${campaign.name}`,
      body,
      reel_ref: d.reelUrl,
      campaign_id: d.campaignId,
      created_by: me.id,
    })
    .select("id")
    .single();
  if (nErr || !note) {
    console.error("[rejections] notification insert failed", nErr);
    if (fineId) await sb.from("fines").delete().eq("id", fineId); // keep it all-or-nothing
    return fail(500, "Couldn't send the notice. Please try again.");
  }

  await audit(me.id, "REEL_REJECTED", "notification", note.id, null, {
    clipperId: d.clipperId,
    campaignId: d.campaignId,
    reelUrl: d.reelUrl,
    reason: d.reason,
    finePaise: finePaise || null,
  });
  if (fineId) {
    await audit(me.id, "FINE_ADDED", "fine", fineId, null, {
      clipperId: d.clipperId,
      campaignId: d.campaignId,
      amountPaise: finePaise,
      reason: d.reason,
      reelRef: d.reelUrl,
    });
  }
  return ok({ id: note.id, fineId });
}
