import { NextResponse } from "next/server";
import { supabaseSession } from "@/lib/portal/session";

export async function POST() {
  await supabaseSession().auth.signOut();
  return NextResponse.json({ ok: true });
}
