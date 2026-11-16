import { getSupabaseAdmin } from "@/lib/supabase";
import { canAccessCampaign, fail, guard, ok, parseBody } from "@/lib/portal/guard";
import { rupeesToPaise } from "@/lib/portal/money";
import { audit } from "@/lib/portal/session";
import { endsBeforeStart, updateCampaignSchema } from "../_schema";

const COLUMNS = "id, name, client, rate_per_million_paise, allowed_platforms, max_accounts_per_clipper, status, starts_on, ends_on";

// PATCH /api/admin/campaigns/:id — edit details (campaigns.manage + access). Rate: super admin only.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await guard({ permission: "campaigns.manage" });
  if ("error" in g) return g.error;
  const { me } = g;
  if (!(await canAccessCampaign(me, params.id))) return fail(403, "You're not assigned to this campaign.");

  const body = await parseBody(req, updateCampaignSchema);
  if ("error" in body) return body.error;
  const d = body.data;

  const db = getSupabaseAdmin();
  const { data: current } = await db.from("campaigns").select(COLUMNS).eq("id", params.id).maybeSingle();
  if (!current) return fail(404, "Campaign not found.");

  const patch: Record<string, unknown> = {};
  if (d.name !== undefined) patch.name = d.name;
  if (d.client !== undefined) patch.client = d.client;
  if (d.allowedPlatforms !== undefined) patch.allowed_platforms = Array.from(new Set(d.allowedPlatforms));
  if (d.maxAccountsPerClipper !== undefined) patch.max_accounts_per_clipper = d.maxAccountsPerClipper;
  if (d.status !== undefined) patch.status = d.status;
  if (d.startsOn !== undefined) patch.starts_on = d.startsOn;
  if (d.endsOn !== undefined) patch.ends_on = d.endsOn;

  let rateChange: { before: number; after: number } | null = null;
  if (d.rateRupees !== undefined) {
    const next = rupeesToPaise(d.rateRupees);
    if (next !== Number(current.rate_per_million_paise)) {
      if (me.role !== "super_admin") return fail(403, "Only the super admin can change the rate.", { rateRupees: "Only the super admin can change this" });
      rateChange = { before: Number(current.rate_per_million_paise), after: next };
      patch.rate_per_million_paise = next;
    }
  }

  const startsOn = (patch.starts_on !== undefined ? patch.starts_on : current.starts_on) as string | null;
  const endsOn = (patch.ends_on !== undefined ? patch.ends_on : current.ends_on) as string | null;
  if (endsBeforeStart(startsOn, endsOn)) {
    return fail(400, "The end date can't be before the start date.", { endsOn: "The end date can't be before the start date" });
  }

  // Only keep fields that actually change, so the audit trail shows real edits.
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    const old = (current as Record<string, unknown>)[k];
    if (JSON.stringify(old) === JSON.stringify(v)) {
      delete patch[k];
      continue;
    }
    if (k === "rate_per_million_paise") continue; // audited separately
    before[k] = old;
    after[k] = v;
  }
  if (Object.keys(patch).length === 0) return ok({ changed: false });

  const { error } = await db.from("campaigns").update(patch).eq("id", params.id);
  if (error) {
    console.error("[campaigns] update failed", error);
    return fail(500, "Couldn't save the campaign.");
  }

  if (rateChange) {
    await audit(me.id, "RATE_CHANGED", "campaign", params.id, { rate_per_million_paise: rateChange.before }, { rate_per_million_paise: rateChange.after });
  }
  if (Object.keys(after).length) {
    const action = Object.keys(after).length === 1 && "status" in after ? "CAMPAIGN_STATUS_CHANGED" : "CAMPAIGN_UPDATED";
    await audit(me.id, action, "campaign", params.id, before, after);
  }
  return ok({ changed: true });
}

// DELETE /api/admin/campaigns/:id — super admin only, and only before any views were entered.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await guard({ superAdmin: true });
  if ("error" in g) return g.error;
  const { me } = g;

  const db = getSupabaseAdmin();
  const { data: current } = await db.from("campaigns").select(COLUMNS).eq("id", params.id).maybeSingle();
  if (!current) return fail(404, "Campaign not found.");

  const { count, error: countError } = await db
    .from("weekly_views")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", params.id);
  if (countError) return fail(500, "Couldn't check the campaign's views.");
  if ((count ?? 0) > 0) {
    return fail(409, "This campaign already has weekly views, so it can't be deleted. Set its status to Ended instead.");
  }

  const { error } = await db.from("campaigns").delete().eq("id", params.id);
  if (error) {
    console.error("[campaigns] delete failed", error);
    return fail(500, "Couldn't delete the campaign.");
  }
  await audit(me.id, "CAMPAIGN_DELETED", "campaign", params.id, current, null);
  return ok();
}
