import { getSupabaseAdmin } from "@/lib/supabase";
import { fail, guard, ok } from "@/lib/portal/guard";
import { audit } from "@/lib/portal/session";

// DELETE /api/portal/accounts/:id — a clipper removes their own pending or rejected account.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await guard({ clipper: true });
  if ("error" in g) return g.error;
  const { me } = g;
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return fail(404, "Account not found.");

  const supabase = getSupabaseAdmin();
  const { data: acc } = await supabase
    .from("social_accounts")
    .select("id, clipper_id, platform, username, status")
    .eq("id", params.id)
    .eq("clipper_id", me.id)
    .maybeSingle();
  if (!acc) return fail(404, "Account not found.");
  if (acc.status === "verified") return fail(400, "Verified accounts can't be removed here. Message your admin if you need it removed.");

  // Never lose earnings history: an account with views on record stays.
  const { count } = await supabase.from("weekly_views").select("id", { count: "exact", head: true }).eq("account_id", acc.id);
  if ((count ?? 0) > 0) return fail(400, "This account has views on record, so it can't be removed. Message your admin.");

  const { error } = await supabase.from("social_accounts").delete().eq("id", acc.id).eq("clipper_id", me.id);
  if (error) return fail(500, "Couldn't remove the account.");
  await audit(me.id, "ACCOUNT_REMOVED", "social_account", acc.id, { platform: acc.platform, username: acc.username, status: acc.status }, null);
  return ok();
}
