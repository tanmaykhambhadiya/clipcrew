import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fail, guard, ok, parseBody } from "@/lib/portal/guard";
import { audit } from "@/lib/portal/session";
import { PLATFORM_LABELS } from "@/components/portal/ui";

const schema = z.object({
  accountIds: z.array(z.uuid("Invalid account.")).max(50, "Too many accounts."),
});

// PUT /api/portal/campaigns/:id/accounts — set which of my verified accounts count toward this campaign.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const g = await guard({ clipper: true });
  if ("error" in g) return g.error;
  const { me } = g;
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return fail(404, "Campaign not found.");
  const body = await parseBody(req, schema);
  if ("error" in body) return body.error;
  const wanted = Array.from(new Set(body.data.accountIds));

  const supabase = getSupabaseAdmin();

  // Must be a member of the campaign.
  const { data: membership } = await supabase
    .from("campaign_clippers")
    .select("campaign:campaigns(id, name, status, allowed_platforms, max_accounts_per_clipper)")
    .eq("campaign_id", params.id)
    .eq("clipper_id", me.id)
    .maybeSingle();
  const campaign = (membership as unknown as { campaign: { id: string; name: string; status: string; allowed_platforms: string[]; max_accounts_per_clipper: number } | null } | null)?.campaign;
  if (!campaign || campaign.status === "draft") return fail(404, "You're not part of this campaign.");
  if (campaign.status !== "active") return fail(400, `This campaign is ${campaign.status}, so its accounts can't be changed. Message your admin if something's wrong.`);
  if (wanted.length > campaign.max_accounts_per_clipper) {
    return fail(400, `This campaign allows up to ${campaign.max_accounts_per_clipper} account${campaign.max_accounts_per_clipper === 1 ? "" : "s"} per clipper.`);
  }

  // Only ever touch this clipper's own accounts.
  const { data: mine } = await supabase.from("social_accounts").select("id, platform, username, status").eq("clipper_id", me.id);
  const myAccounts = new Map((mine ?? []).map((a) => [a.id, a]));
  const myIds = Array.from(myAccounts.keys());

  const { data: currentLinks } = myIds.length
    ? await supabase.from("campaign_accounts").select("account_id").eq("campaign_id", campaign.id).in("account_id", myIds)
    : { data: [] as { account_id: string }[] };
  const current = new Set((currentLinks ?? []).map((l) => l.account_id));

  const toAdd = wanted.filter((id) => !current.has(id));
  const toRemove = Array.from(current).filter((id) => !wanted.includes(id));

  for (const id of toAdd) {
    const a = myAccounts.get(id);
    if (!a) return fail(403, "You can only add your own accounts.");
    if (a.status !== "verified") return fail(400, `@${a.username} isn't verified yet. Only verified accounts can join a campaign.`);
    if (!campaign.allowed_platforms.includes(a.platform)) {
      return fail(400, `${PLATFORM_LABELS[a.platform] ?? a.platform} accounts don't count for this campaign.`);
    }
  }

  if (toRemove.length) {
    const { data: viewed } = await supabase
      .from("weekly_views")
      .select("account_id")
      .eq("campaign_id", campaign.id)
      .in("account_id", toRemove)
      .limit(1);
    if (viewed?.length) {
      const a = myAccounts.get(viewed[0].account_id);
      return fail(409, `@${a?.username ?? "that account"} already has views recorded in this campaign, so it can't be removed. Message your admin if it needs to change.`);
    }
  }

  if (!toAdd.length && !toRemove.length) return ok({ accountIds: wanted });

  if (toRemove.length) {
    const { error } = await supabase.from("campaign_accounts").delete().eq("campaign_id", campaign.id).in("account_id", toRemove);
    if (error) return fail(500, "Couldn't save your accounts. Please try again.");
  }
  if (toAdd.length) {
    const { error } = await supabase.from("campaign_accounts").insert(toAdd.map((account_id) => ({ campaign_id: campaign.id, account_id })));
    if (error) {
      if (error.code === "23505") return fail(409, "That account is already linked. Refresh and try again.");
      return fail(500, "Couldn't save your accounts. Please try again.");
    }
  }

  // Re-check the limit after writing, in case two tabs saved at once.
  const { count } = await supabase
    .from("campaign_accounts")
    .select("account_id", { count: "exact", head: true })
    .eq("campaign_id", campaign.id)
    .in("account_id", myIds);
  if ((count ?? 0) > campaign.max_accounts_per_clipper && toAdd.length) {
    await supabase.from("campaign_accounts").delete().eq("campaign_id", campaign.id).in("account_id", toAdd);
    return fail(409, "Your accounts changed in another tab. Refresh and try again.");
  }

  await audit(me.id, "CAMPAIGN_ACCOUNTS_SET", "campaign", campaign.id, { accountIds: Array.from(current) }, { accountIds: wanted, added: toAdd, removed: toRemove });
  return ok({ accountIds: wanted });
}
