import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fail, guard, notify, ok, parseBody } from "@/lib/portal/guard";
import { audit } from "@/lib/portal/session";
import { PLATFORM_LABELS } from "@/components/portal/ui";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("verify") }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(3, "Give the clipper a reason.").max(300) }),
  z.object({ action: z.literal("revoke"), reason: z.string().trim().min(3, "Give the clipper a reason.").max(300) }),
]);

// PATCH /api/admin/accounts/:id — verify / reject a pending account; super admin can revoke a verified one.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await guard({ permission: "accounts.verify" });
  if ("error" in g) return g.error;
  const { me } = g;
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return fail(404, "Account not found.");
  const body = await parseBody(req, schema);
  if ("error" in body) return body.error;
  const d = body.data;

  const supabase = getSupabaseAdmin();
  const { data: acc } = await supabase
    .from("social_accounts")
    .select("id, clipper_id, platform, username, status, verified_by, verified_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!acc) return fail(404, "Account not found.");

  const handle = `@${acc.username}`;
  const platformLabel = PLATFORM_LABELS[acc.platform] ?? acc.platform;
  const before = { status: acc.status, verified_by: acc.verified_by, verified_at: acc.verified_at };

  switch (d.action) {
    case "verify": {
      if (acc.status === "verified") return fail(409, "This account is already verified.");
      const after = { status: "verified", verified_by: me.id, verified_at: new Date().toISOString() };
      const { data: updated, error } = await supabase.from("social_accounts").update(after).eq("id", acc.id).eq("status", acc.status).select("id");
      if (!error && !updated?.length) return fail(409, "Someone else just changed this account. Refresh and try again.");
      if (error) return fail(500, "Couldn't verify the account.");
      await audit(me.id, "ACCOUNT_VERIFIED", "social_account", acc.id, before, { ...after, platform: acc.platform, username: acc.username });
      await notify(acc.clipper_id, {
        kind: "account_verified",
        title: `${platformLabel} ${handle} is verified`,
        body: "You can remove the code from your bio now, and choose which campaigns this account counts toward on the Campaigns page.",
        createdBy: me.id,
      });
      return ok();
    }
    case "reject": {
      if (acc.status !== "pending") {
        return fail(409, acc.status === "verified" ? "This account is verified — use Revoke instead." : "This account is already rejected.");
      }
      const after = { status: "rejected", verified_by: null, verified_at: null };
      const { data: updated, error } = await supabase.from("social_accounts").update(after).eq("id", acc.id).eq("status", "pending").select("id");
      if (!error && !updated?.length) return fail(409, "Someone else just changed this account. Refresh and try again.");
      if (error) return fail(500, "Couldn't reject the account.");
      await audit(me.id, "ACCOUNT_REJECTED", "social_account", acc.id, before, { ...after, reason: d.reason, platform: acc.platform, username: acc.username });
      await notify(acc.clipper_id, {
        kind: "account_rejected",
        title: `${platformLabel} ${handle} couldn't be verified`,
        body: d.reason,
        createdBy: me.id,
      });
      return ok();
    }
    case "revoke": {
      if (me.role !== "super_admin") return fail(403, "Only the super admin can revoke a verified account.");
      if (acc.status !== "verified") return fail(409, "Only verified accounts can be revoked.");
      const after = { status: "rejected", verified_by: null, verified_at: null };
      const { data: updated, error } = await supabase.from("social_accounts").update(after).eq("id", acc.id).eq("status", "verified").select("id");
      if (!error && !updated?.length) return fail(409, "Someone else just changed this account. Refresh and try again.");
      if (error) return fail(500, "Couldn't revoke the account.");

      // Free up campaign slots, but keep links that already have views so history stays intact.
      const [{ data: links }, { data: viewed }] = await Promise.all([
        supabase.from("campaign_accounts").select("campaign_id").eq("account_id", acc.id),
        supabase.from("weekly_views").select("campaign_id").eq("account_id", acc.id),
      ]);
      const keep = new Set((viewed ?? []).map((v) => v.campaign_id));
      const drop = (links ?? []).map((l) => l.campaign_id).filter((c) => !keep.has(c));
      if (drop.length) await supabase.from("campaign_accounts").delete().eq("account_id", acc.id).in("campaign_id", drop);

      await audit(me.id, "ACCOUNT_REVOKED", "social_account", acc.id, before, {
        ...after,
        reason: d.reason,
        platform: acc.platform,
        username: acc.username,
        unlinked_campaigns: drop,
      });
      await notify(acc.clipper_id, {
        kind: "account_rejected",
        title: `${platformLabel} ${handle} is no longer verified`,
        body: d.reason,
        createdBy: me.id,
      });
      return ok();
    }
  }
}
