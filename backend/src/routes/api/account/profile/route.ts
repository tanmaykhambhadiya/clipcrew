import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fail, guard, ok, parseBody } from "@/lib/portal/guard";
import { audit } from "@/lib/portal/session";

const schema = z.object({
  upiId: z
    .string()
    .trim()
    .max(80, "That UPI ID is too long")
    .refine((v) => v === "" || /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.-]{1,40}$/.test(v), "Use the format name@bank, e.g. riya@okaxis"),
  phone: z
    .string()
    .trim()
    .max(20, "That phone number is too long")
    .refine((v) => v === "" || /^\+?[0-9][0-9 -]{6,18}$/.test(v), "Digits only, optionally starting with + (e.g. +91 98765 43210)"),
});

// PATCH /api/account/profile — a clipper edits their own UPI ID and phone. Nothing else, nobody else's row.
export async function PATCH(req: Request) {
  const g = await guard({ clipper: true });
  if ("error" in g) return g.error;
  const { me } = g;

  const body = await parseBody(req, schema);
  if ("error" in body) return body.error;
  const next = { upi_id: body.data.upiId || null, phone: body.data.phone || null };

  const db = getSupabaseAdmin();
  const { data: before } = await db.from("profiles").select("upi_id, phone").eq("id", me.id).maybeSingle();
  if (!before) return fail(404, "We couldn't find your profile.");
  if (before.upi_id === next.upi_id && before.phone === next.phone) return ok({ profile: next });

  const { error } = await db.from("profiles").update(next).eq("id", me.id);
  if (error) {
    console.error("[account/profile] update failed", error);
    return fail(500, "Couldn't save your details. Please try again.");
  }

  await audit(me.id, "PROFILE_UPDATED", "profile", me.id, before, next);
  return ok({ profile: next });
}
