import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { verifyPassword } from "@/lib/portal/password";
import { audit, startSession } from "@/lib/portal/session";

const bodySchema = z.object({
  loginId: z.string().trim().toLowerCase().min(1).max(30),
  password: z.string().min(1).max(200),
});

// One message for every failure, so the response never reveals whether a login ID exists.
const BAD = { ok: false, error: "Wrong login ID or password." };

export async function POST(req: Request) {
  if (!rateLimit("login", clientIp(req))) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json(BAD, { status: 400 });
  const { loginId, password } = parsed.data;

  const { data } = await getSupabaseAdmin()
    .from("profiles")
    .select("id, role, status, credentials(password_hash)")
    .eq("login_id", loginId)
    .maybeSingle();
  const profile = data as { id: string; role: string; status: string; credentials: { password_hash: string } | null } | null;

  // verifyPassword does the same work for unknown users, so timing doesn't reveal valid login IDs.
  const valid = await verifyPassword(password, profile?.credentials?.password_hash);
  if (!profile || !valid) return NextResponse.json(BAD, { status: 401 });
  if (profile.status !== "active") {
    return NextResponse.json({ ok: false, error: "This account has been deactivated. Contact your admin." }, { status: 403 });
  }

  await startSession(profile.id);
  await audit(profile.id, "LOGIN", "profile", profile.id);
  return NextResponse.json({ ok: true, redirect: profile.role === "clipper" ? "/portal" : "/admin" });
}
