import "server-only";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { staffCampaignIds } from "@/lib/portal/guard";
import { can, type Me } from "@/lib/portal/session";

// Shared server helpers for /admin/rejections and its API routes
// (/api/admin/rejections, /api/admin/fines, /api/admin/announcements).

export type CampaignOpt = { id: string; name: string; status: string };
export type ClipperOpt = { id: string; name: string; loginId: string };

/** Who may open the page at all: anyone who can reject reels, add fines or send announcements. */
export function canUseNoticesPage(me: Me) {
  return can(me, "rejections.send") || can(me, "fines.create") || can(me, "campaigns.manage");
}

/** http(s) link, at most 500 characters. */
export const httpUrl = z
  .string()
  .trim()
  .max(500, "Keep the link under 500 characters")
  .refine((v) => {
    if (!/^https?:\/\//i.test(v)) return false;
    try {
      new URL(v);
      return true;
    } catch {
      return false;
    }
  }, "Paste a full link starting with http:// or https://");

/** Fine amount typed in rupees (₹1 – ₹1,00,000, max 2 decimals). */
export const rupeeAmount = z
  .number({ error: "Enter an amount in ₹" })
  .min(1, "Minimum fine is ₹1")
  .max(100000, "Maximum fine is ₹1,00,000");

export async function getCampaign(id: string): Promise<{ id: string; name: string } | null> {
  const { data } = await getSupabaseAdmin().from("campaigns").select("id, name").eq("id", id).maybeSingle();
  return data ?? null;
}

export async function getActiveClipper(id: string): Promise<{ id: string; full_name: string } | null> {
  const { data } = await getSupabaseAdmin()
    .from("profiles")
    .select("id, full_name, role, status")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.role !== "clipper" || data.status !== "active") return null;
  return { id: data.id, full_name: data.full_name };
}

export async function isCampaignMember(campaignId: string, clipperId: string): Promise<boolean> {
  const { data } = await getSupabaseAdmin()
    .from("campaign_clippers")
    .select("clipper_id")
    .eq("campaign_id", campaignId)
    .eq("clipper_id", clipperId)
    .maybeSingle();
  return !!data;
}

/** Names for a set of ids (profiles or campaigns). */
export async function nameMaps(profileIds: (string | null)[], campaignIds: (string | null)[]) {
  const sb = getSupabaseAdmin();
  const pIds = Array.from(new Set(profileIds.filter((x): x is string => !!x)));
  const cIds = Array.from(new Set(campaignIds.filter((x): x is string => !!x)));
  const [p, c] = await Promise.all([
    pIds.length ? sb.from("profiles").select("id, full_name, login_id").in("id", pIds) : Promise.resolve({ data: [] }),
    cIds.length ? sb.from("campaigns").select("id, name").in("id", cIds) : Promise.resolve({ data: [] }),
  ]);
  const people = new Map<string, { name: string; loginId: string }>();
  for (const r of (p.data ?? []) as { id: string; full_name: string; login_id: string }[])
    people.set(r.id, { name: r.full_name, loginId: r.login_id });
  const campaigns = new Map<string, string>();
  for (const r of (c.data ?? []) as { id: string; name: string }[]) campaigns.set(r.id, r.name);
  return { people, campaigns };
}

/**
 * PostgREST `or` filter limiting rows to what this staff member may see:
 * campaigns they can access, plus campaign-less rows when `includeNullCampaign`.
 * Returns undefined for "no limit" (super admin) and null for "nothing visible".
 */
export function scopeFilter(ids: string[] | null, includeNullCampaign: string | false): string | undefined | null {
  if (ids === null) return undefined;
  const parts: string[] = [];
  if (ids.length) parts.push(`campaign_id.in.(${ids.join(",")})`);
  if (includeNullCampaign) parts.push(includeNullCampaign);
  return parts.length ? parts.join(",") : null;
}

/** Everything the send forms need: campaigns this person can work on and their clippers. */
export async function loadFormData(me: Me) {
  const sb = getSupabaseAdmin();
  const ids = await staffCampaignIds(me);

  let campaigns: CampaignOpt[] = [];
  if (ids === null || ids.length) {
    let q = sb.from("campaigns").select("id, name, status").order("created_at", { ascending: false });
    if (ids !== null) q = q.in("id", ids);
    const { data } = await q;
    campaigns = (data ?? []) as CampaignOpt[];
  }

  const members: Record<string, string[]> = {};
  const memberIds = new Set<string>();
  if (campaigns.length) {
    const { data } = await sb
      .from("campaign_clippers")
      .select("campaign_id, clipper_id")
      .in(
        "campaign_id",
        campaigns.map((c) => c.id),
      )
      .limit(10000);
    for (const r of (data ?? []) as { campaign_id: string; clipper_id: string }[]) {
      (members[r.campaign_id] ??= []).push(r.clipper_id);
      memberIds.add(r.clipper_id);
    }
  }

  // Fines without a campaign can go to any active clipper, so fines.create holders get the full list.
  const wantAll = can(me, "fines.create");
  let q = sb.from("profiles").select("id, full_name, login_id").eq("role", "clipper").eq("status", "active").order("full_name");
  if (!wantAll) q = q.in("id", memberIds.size ? Array.from(memberIds) : ["00000000-0000-0000-0000-000000000000"]);
  const { data: people } = await q.limit(10000);
  const clippers: ClipperOpt[] = ((people ?? []) as { id: string; full_name: string; login_id: string }[]).map((p) => ({
    id: p.id,
    name: p.full_name,
    loginId: p.login_id,
  }));
  const active = new Set(clippers.map((c) => c.id));
  for (const k of Object.keys(members)) members[k] = members[k].filter((id) => active.has(id));

  return { campaigns, members, clippers };
}
