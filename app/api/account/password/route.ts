import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { fail, ok, parseBody } from "@/lib/portal/guard";
import { hashPassword, verifyPassword } from "@/lib/portal/password";
import { audit, endAllSessions, getMe } from "@/lib/portal/session";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(200),
    newPassword: z.string().min(8, "At least 8 characters").max(100, "At most 100 characters"),
    confirmPassword: z.string().max(100),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { path: ["confirmPassword"], message: "The two passwords don't match" })
  .refine((d) => d.newPassword !== d.currentPassword, { path: ["newPassword"], message: "Pick a password different from your current one" });

const WRONG = "Your current password is incorrect.";

// POST /api/account/password — any signed-in, active user changes their own password.
export async function POST(req: Request) {
  const me = await getMe();
  if (!me) return fail(401, "Please sign in again.");
  if (!rateLimit("password", clientIp(req))) return fail(429, "Too many attempts. Try again in a few minutes.");

  const body = await parseBody(req, schema);
  if ("error" in body) return body.error;
  const { currentPassword, newPassword } = body.data;

  const db = getSupabaseAdmin();
  const { data: cred } = await db.from("credentials").select("password_hash").eq("user_id", me.id).maybeSingle();
  // Same answer for every failure, whatever the reason.
  if (!(await verifyPassword(currentPassword, cred?.password_hash))) return fail(400, WRONG, { currentPassword: WRONG });

  const { error } = await db
    .from("credentials")
    .update({ password_hash: await hashPassword(newPassword), updated_at: new Date().toISOString() })
    .eq("user_id", me.id);
  if (error) {
    console.error("[account/password] update failed", error);
    return fail(500, "Couldn't change your password. Please try again.");
  }

  await endAllSessions(me.id, { keepCurrent: true }); // sign out other devices, stay signed in here
  await audit(me.id, "PASSWORD_CHANGED", "profile", me.id);
  return ok();
}
