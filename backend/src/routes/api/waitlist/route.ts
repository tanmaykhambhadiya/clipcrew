import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { firstErrors, waitlistRequestSchema } from "@/lib/validation";

const MIN_FILL_MS = 2000;

export async function POST(req: Request) {
  if (!rateLimit("waitlist", clientIp(req))) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Please try again in a few minutes." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = waitlistRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Please check the form.", fields: firstErrors(parsed.error) }, { status: 400 });
  }

  const { website, elapsedMs, ...data } = parsed.data;
  if (website || elapsedMs < MIN_FILL_MS) {
    return NextResponse.json({ ok: false, error: "Something looked off. Please try again." }, { status: 400 });
  }

  // Role-specific fields only make sense for their role.
  const row = {
    role: data.role,
    name: data.name,
    email: data.email,
    whatsapp: data.whatsapp ?? null,
    handle: data.handle ?? null,
    audience_size: data.role === "creator" ? data.audience_size ?? null : null,
    release_date: data.role === "promoter" ? data.release_date ?? null : null,
    clipping_experience: data.role === "clipper" ? data.clipping_experience ?? null : null,
    source: data.source ?? null,
  };

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("waitlist").insert(row);
    if (error) {
      if (error.code === "23505") return NextResponse.json({ ok: true, already: true });
      throw error;
    }
    const { count, error: countError } = await supabase.from("waitlist").select("id", { count: "exact", head: true });
    if (countError) throw countError;
    return NextResponse.json({ ok: true, position: count ?? undefined });
  } catch (err) {
    console.error("[waitlist] insert failed", err);
    return NextResponse.json({ ok: false, error: "Couldn't save right now. Please try again." }, { status: 500 });
  }
}
