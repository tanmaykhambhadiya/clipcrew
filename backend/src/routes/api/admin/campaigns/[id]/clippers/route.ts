import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { canAccessCampaign, fail, guard, notify, ok, parseBody } from "@/lib/portal/guard";
import type { Me } from "@/lib/portal/session";
import { audit } from "@/lib/portal/session";

const addSchema = z.object({
  clipperIds: z.array(z.uuid()).min(1, "Pick at least one clipper").max(100, "Add up to 100 clippers at a time"),
});
const removeSchema = z.object({ clipperId: z.uuid("Pick a clipper") });

async function access(me: Me, campaignId: string) {
  if (!(await canAccessCampaign(me, campaignId))) return fail(403, "You're not assigned to this campaign.");
  const { data: campaign } = await getSupabaseAdmin().from("campaigns").select("id, name").eq("id", campaignId).maybeSingle();
  if (!campaign) return fail(404, "Campaign not found.");
  return campaign as { id: string; name: string };
}

async function memberIds(campaignId: string): Promise<Set<string>> {
  const { data } = await getSupabaseAdmin().from("campaign_clippers").select("clipper_id").eq("campaign_id", campaignId);
  return new Set((data ?? []).map((r) => r.clipper_id as string));
}

// GET /api/admin/campaigns/:id/clippers?q= — active clippers not yet in the campaign, for the picker.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const g = await guard({ permission: "campaigns.manage" });
  if ("error" in g) return g.error;
  const campaign = await access(g.me, params.id);
  if (campaign instanceof Response) return campaign;

  // Strip everything PostgREST treats as syntax inside or() filters.
  const q = (new URL(req.url).searchParams.get("q") ?? "").toLowerCase().replace(/[^a-z0-9 ._@-]/g, "").trim().slice(0, 40);

  let query = getSupabaseAdmin()
    .from("profiles")
    .select("id, login_id, full_name")
    .eq("role", "clipper")
    .eq("status", "active")
    .order("full_name")
    .limit(80);
  if (q) query = query.or(`login_id.ilike.%${q}%,full_name.ilike.%${q}%`);
  const [{ data, error }, members] = await Promise.all([query, memberIds(params.id)]);
  if (error) return fail(500, "Couldn't search clippers.");

  const clippers = (data ?? []).filter((c) => !members.has(c.id)).slice(0, 25);
  return ok({ clippers });
}

// POST /api/admin/campaigns/:id/clippers — add clippers (campaigns.manage + access). Each gets an inbox notice.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await guard({ permission: "campaigns.manage" });
  if ("error" in g) return g.error;
  const { me } = g;
  const campaign = await access(me, params.id);
  if (campaign instanceof Response) return campaign;

  const body = await parseBody(req, addSchema);
  if ("error" in body) return body.error;

  const db = getSupabaseAdmin();
  const ids = Array.from(new Set(body.data.clipperIds));
  const { data: found } = await db.from("profiles").select("id, login_id, role, status").in("id", ids);
  const valid = (found ?? []).filter((p) => p.role === "clipper" && p.status === "active");
  if (valid.length !== ids.length) return fail(400, "Some of those people aren't active clippers. Refresh and try again.");

  const members = await memberIds(params.id);
  const fresh = valid.filter((p) => !members.has(p.id));
  if (fresh.length === 0) return ok({ added: 0 });

  const { error } = await db.from("campaign_clippers").insert(fresh.map((p) => ({ campaign_id: params.id, clipper_id: p.id })));
  if (error) {
    console.error("[campaigns] add clippers failed", error);
    return fail(500, "Couldn't add the clippers.");
  }

  for (const p of fresh) {
    await notify(p.id, {
      kind: "info",
      title: `You've been added to ${campaign.name}`,
      body: "Open Campaigns in your portal to see the rules and link your verified accounts.",
      campaignId: params.id,
      createdBy: me.id,
    });
    await audit(me.id, "CLIPPER_ADDED_TO_CAMPAIGN", "campaign", params.id, null, { clipperId: p.id, loginId: p.login_id });
  }
  return ok({ added: fresh.length });
}

// DELETE /api/admin/campaigns/:id/clippers — remove a clipper. Their past weekly views stay;
// their accounts are unlinked from this campaign.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const g = await guard({ permission: "campaigns.manage" });
  if ("error" in g) return g.error;
  const { me } = g;
  const campaign = await access(me, params.id);
  if (campaign instanceof Response) return campaign;

  const body = await parseBody(req, removeSchema);
  if ("error" in body) return body.error;
  const clipperId = body.data.clipperId;

  const db = getSupabaseAdmin();
  const { data: membership } = await db
    .from("campaign_clippers")
    .select("clipper_id, joined_at")
    .eq("campaign_id", params.id)
    .eq("clipper_id", clipperId)
    .maybeSingle();
  if (!membership) return fail(404, "That clipper isn't in this campaign.");

  const { data: accounts } = await db.from("social_accounts").select("id").eq("clipper_id", clipperId);
  const accountIds = (accounts ?? []).map((a) => a.id as string);
  if (accountIds.length) {
    const { error: unlinkError } = await db.from("campaign_accounts").delete().eq("campaign_id", params.id).in("account_id", accountIds);
    if (unlinkError) {
      console.error("[campaigns] unlink accounts failed", unlinkError);
      return fail(500, "Couldn't unlink the clipper's accounts.");
    }
  }

  const { error } = await db.from("campaign_clippers").delete().eq("campaign_id", params.id).eq("clipper_id", clipperId);
  if (error) {
    console.error("[campaigns] remove clipper failed", error);
    return fail(500, "Couldn't remove the clipper.");
  }

  const { data: profile } = await db.from("profiles").select("login_id").eq("id", clipperId).maybeSingle();
  await audit(
    me.id,
    "CLIPPER_REMOVED_FROM_CAMPAIGN",
    "campaign",
    params.id,
    { clipperId, loginId: profile?.login_id ?? null, joinedAt: membership.joined_at },
    null,
  );
  return ok();
}
