import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fail, guard, ok, parseBody } from "@/lib/portal/guard";
import { audit } from "@/lib/portal/session";

const schema = z.object({ staffId: z.uuid("Pick a staff member") });

async function load(campaignId: string, staffId: string) {
  const db = getSupabaseAdmin();
  const [{ data: campaign }, { data: staff }] = await Promise.all([
    db.from("campaigns").select("id, name").eq("id", campaignId).maybeSingle(),
    db.from("profiles").select("id, login_id, full_name, role, status").eq("id", staffId).maybeSingle(),
  ]);
  return { campaign, staff };
}

// POST /api/admin/campaigns/:id/staff — assign a staff member (super admin only).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await guard({ superAdmin: true });
  if ("error" in g) return g.error;
  const { me } = g;

  const body = await parseBody(req, schema);
  if ("error" in body) return body.error;

  const { campaign, staff } = await load(params.id, body.data.staffId);
  if (!campaign) return fail(404, "Campaign not found.");
  if (!staff || staff.role !== "admin") return fail(400, "That person isn't a staff member.", { staffId: "Not a staff member" });
  if (staff.status !== "active") return fail(400, "That staff member has been terminated.", { staffId: "Terminated" });

  const { error } = await getSupabaseAdmin()
    .from("campaign_staff")
    .upsert({ campaign_id: params.id, staff_id: staff.id }, { onConflict: "campaign_id,staff_id", ignoreDuplicates: true });
  if (error) {
    console.error("[campaigns] assign staff failed", error);
    return fail(500, "Couldn't assign the staff member.");
  }
  await audit(me.id, "CAMPAIGN_STAFF_ASSIGNED", "campaign", params.id, null, { staffId: staff.id, loginId: staff.login_id });
  return ok();
}

// DELETE /api/admin/campaigns/:id/staff — unassign a staff member (super admin only).
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const g = await guard({ superAdmin: true });
  if ("error" in g) return g.error;
  const { me } = g;

  const body = await parseBody(req, schema);
  if ("error" in body) return body.error;

  const { campaign, staff } = await load(params.id, body.data.staffId);
  if (!campaign) return fail(404, "Campaign not found.");

  const { error } = await getSupabaseAdmin()
    .from("campaign_staff")
    .delete()
    .eq("campaign_id", params.id)
    .eq("staff_id", body.data.staffId);
  if (error) {
    console.error("[campaigns] unassign staff failed", error);
    return fail(500, "Couldn't remove the staff member.");
  }
  await audit(me.id, "CAMPAIGN_STAFF_REMOVED", "campaign", params.id, { staffId: body.data.staffId, loginId: staff?.login_id ?? null }, null);
  return ok();
}
