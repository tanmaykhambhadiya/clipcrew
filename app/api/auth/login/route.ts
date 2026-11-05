import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { loginIdToEmail } from "@/lib/portal/permissions";
import { audit, supabaseSession } from "@/lib/portal/session";

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

  const supabase = supabaseSession();
  const { data, error } = await supabase.auth.signInWithPassword({ email: loginIdToEmail(loginId), password });
  if (error || !data.user) return NextResponse.json(BAD, { status: 401 });

  const { data: profile } = await getSupabaseAdmin()
    .from("profiles")
    .select("role, status")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile || profile.status !== "active") {
    await supabase.auth.signOut();
    return NextResponse.json(
      { ok: false, error: profile ? "This account has been deactivated. Contact your admin." : BAD.error },
      { status: 403 },
    );
  }

  await audit(data.user.id, "LOGIN", "profile", data.user.id);
  return NextResponse.json({ ok: true, redirect: profile.role === "clipper" ? "/portal" : "/admin" });
}
