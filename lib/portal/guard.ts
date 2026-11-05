import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { Permission } from "./permissions";
import { can, getMe, isStaff, type Me } from "./session";

// Shared helpers for every /api/admin/* and /api/portal/* route. Pattern:
//   const g = await guard({ permission: "views.enter" }); if ("error" in g) return g.error; const { me } = g;

export const ok = (data: Record<string, unknown> = {}) => NextResponse.json({ ok: true, ...data });
export const fail = (status: number, error: string, fields?: Record<string, string>) =>
  NextResponse.json({ ok: false, error, ...(fields ? { fields } : {}) }, { status });

type GuardOpts =
  | { clipper: true } // signed-in clipper only
  | { staff: true } // any staff (super admin or admin)
  | { permission: Permission } // staff holding this permission (super admin always passes)
  | { superAdmin: true };

export async function guard(opts: GuardOpts): Promise<{ me: Me } | { error: NextResponse }> {
  const me = await getMe();
  if (!me) return { error: fail(401, "Please sign in again.") };
  if ("clipper" in opts && me.role !== "clipper") return { error: fail(403, "Clippers only.") };
  if ("staff" in opts && !isStaff(me)) return { error: fail(403, "Staff only.") };
  if ("permission" in opts && !can(me, opts.permission)) return { error: fail(403, "You don't have permission to do that.") };
  if ("superAdmin" in opts && me.role !== "super_admin") return { error: fail(403, "Only the super admin can do that.") };
  return { me };
}

/** Validates a JSON body. Returns the data or a ready 400 response with per-field messages. */
export async function parseBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { error: NextResponse }> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (parsed.success) return { data: parsed.data };
  const fields: Record<string, string> = {};
  for (const i of parsed.error.issues) {
    const k = String(i.path[0] ?? "form");
    if (!fields[k]) fields[k] = i.message;
  }
  return { error: fail(400, Object.values(fields)[0] ?? "Please check the form.", fields) };
}

/** Campaign ids a staff member may work on: null = all (super admin), otherwise their assignments. */
export async function staffCampaignIds(me: Me): Promise<string[] | null> {
  if (me.role === "super_admin") return null;
  const { data } = await getSupabaseAdmin().from("campaign_staff").select("campaign_id").eq("staff_id", me.id);
  return (data ?? []).map((r) => r.campaign_id);
}

/** True if this staff member is the super admin or is assigned to the campaign. */
export async function canAccessCampaign(me: Me, campaignId: string): Promise<boolean> {
  if (me.role === "super_admin") return true;
  if (me.role !== "admin") return false;
  const { data } = await getSupabaseAdmin()
    .from("campaign_staff")
    .select("campaign_id")
    .eq("staff_id", me.id)
    .eq("campaign_id", campaignId)
    .maybeSingle();
  return !!data;
}

export type NotificationKind = "reel_rejected" | "fine" | "account_verified" | "account_rejected" | "payout" | "info";

/** Puts a message in a clipper's inbox (the 🔔 panel). */
export async function notify(
  clipperId: string,
  n: { kind: NotificationKind; title: string; body?: string; reelRef?: string; campaignId?: string | null; createdBy?: string },
) {
  const { error } = await getSupabaseAdmin().from("notifications").insert({
    clipper_id: clipperId,
    kind: n.kind,
    title: n.title,
    body: n.body ?? null,
    reel_ref: n.reelRef ?? null,
    campaign_id: n.campaignId ?? null,
    created_by: n.createdBy ?? null,
  });
  if (error) console.error("[notify] failed", error);
}
