import { getSupabaseAdmin } from "@/lib/supabase";
import { fail, guard, ok, parseBody } from "@/lib/portal/guard";
import { rupeesToPaise } from "@/lib/portal/money";
import { audit } from "@/lib/portal/session";
import { createCampaignSchema } from "./_schema";

// GET /api/admin/campaigns — campaigns this staff member can see (super admin: all).
export async function GET() {
  const g = await guard({ staff: true });
  if ("error" in g) return g.error;
  const { me } = g;

  let q = getSupabaseAdmin()
    .from("campaigns")
    .select("id, name, client, rate_per_million_paise, allowed_platforms, max_accounts_per_clipper, status, starts_on, ends_on, created_at")
    .order("created_at", { ascending: false });
  if (me.role !== "super_admin") {
    const { data: rows } = await getSupabaseAdmin().from("campaign_staff").select("campaign_id").eq("staff_id", me.id);
    const ids = (rows ?? []).map((r) => r.campaign_id as string);
    if (ids.length === 0) return ok({ campaigns: [] });
    q = q.in("id", ids);
  }
  const { data, error } = await q;
  if (error) return fail(500, "Couldn't load campaigns.");
  return ok({ campaigns: data });
}

// POST /api/admin/campaigns — create a campaign (campaigns.manage).
export async function POST(req: Request) {
  const g = await guard({ permission: "campaigns.manage" });
  if ("error" in g) return g.error;
  const { me } = g;

  const body = await parseBody(req, createCampaignSchema);
  if ("error" in body) return body.error;
  const d = body.data;

  const row = {
    name: d.name,
    client: d.client ?? null,
    rate_per_million_paise: rupeesToPaise(d.rateRupees),
    allowed_platforms: Array.from(new Set(d.allowedPlatforms)),
    max_accounts_per_clipper: d.maxAccountsPerClipper,
    status: d.status,
    starts_on: d.startsOn ?? null,
    ends_on: d.endsOn ?? null,
    created_by: me.id,
  };

  const db = getSupabaseAdmin();
  const { data: created, error } = await db.from("campaigns").insert(row).select("id").single();
  if (error || !created) {
    console.error("[campaigns] create failed", error);
    return fail(500, "Couldn't create the campaign.");
  }

  // A staff member who creates a campaign is assigned to it, otherwise they couldn't open it.
  if (me.role === "admin") {
    await db.from("campaign_staff").insert({ campaign_id: created.id, staff_id: me.id });
  }

  await audit(me.id, "CAMPAIGN_CREATED", "campaign", created.id, null, row);
  return ok({ campaign: { id: created.id } });
}
