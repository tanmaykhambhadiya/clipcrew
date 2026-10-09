import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { contactRequestSchema, firstErrors } from "@/lib/validation";

export async function POST(req: Request) {
  if (!rateLimit("contact", clientIp(req))) {
    return NextResponse.json({ ok: false, error: "Too many messages. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = contactRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Please check the form.", fields: firstErrors(parsed.error) }, { status: 400 });
  }

  const { website, ...data } = parsed.data;
  if (website) {
    return NextResponse.json({ ok: false, error: "Something looked off. Please try again." }, { status: 400 });
  }

  try {
    const { error } = await getSupabaseAdmin().from("contact_messages").insert(data);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contact] insert failed", err);
    return NextResponse.json({ ok: false, error: "Couldn't send right now. Please try again." }, { status: 500 });
  }
}
