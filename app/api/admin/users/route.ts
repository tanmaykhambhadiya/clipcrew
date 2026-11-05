import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { PERMISSION_KEYS, loginIdToEmail } from "@/lib/portal/permissions";
import { generatePassword } from "@/lib/portal/password";
import { audit, can, getMe, isStaff } from "@/lib/portal/session";

const createSchema = z.object({
  loginId: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,30}$/, "3–30 characters: letters, numbers, . _ -"),
  fullName: z.string().trim().min(1, "Enter a name").max(80),
  role: z.enum(["clipper", "admin"]),
  password: z.string().min(8, "At least 8 characters").max(100).optional(), // omitted → generated
  phone: z.string().trim().max(20).optional(),
  upiId: z.string().trim().max(80).optional(),
  permissions: z.array(z.enum(PERMISSION_KEYS as [string, ...string[]])).optional(),
});

// GET /api/admin/users — staff with "add clippers" see clippers; only the super admin sees staff too.
export async function GET() {
  const me = await getMe();
  if (!me || !isStaff(me) || !can(me, "users.create")) return NextResponse.json({ ok: false }, { status: 403 });

  let q = getSupabaseAdmin()
    .from("profiles")
    .select("id, login_id, full_name, role, status, permissions, phone, upi_id, created_at, terminated_at, termination_reason")
    .order("created_at", { ascending: false });
  if (me.role !== "super_admin") q = q.eq("role", "clipper");
  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: "Couldn't load users." }, { status: 500 });
  return NextResponse.json({ ok: true, users: data });
}

// POST /api/admin/users — create a clipper (needs users.create) or a staff member (super admin only).
export async function POST(req: Request) {
  const me = await getMe();
  if (!me || !isStaff(me) || !can(me, "users.create")) return NextResponse.json({ ok: false }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0] ?? "form"), i.message]));
    return NextResponse.json({ ok: false, error: "Please check the form.", fields }, { status: 400 });
  }
  const d = parsed.data;
  if (d.role === "admin" && me.role !== "super_admin") {
    return NextResponse.json({ ok: false, error: "Only the super admin can add staff." }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data: taken } = await supabase.from("profiles").select("id").eq("login_id", d.loginId).maybeSingle();
  if (taken) return NextResponse.json({ ok: false, error: "That login ID is already taken.", fields: { loginId: "Already taken" } }, { status: 409 });

  const password = d.password ?? generatePassword();
  const { data: created, error: authError } = await supabase.auth.admin.createUser({
    email: loginIdToEmail(d.loginId),
    password,
    email_confirm: true,
  });
  if (authError || !created.user) {
    console.error("[users] auth create failed", authError);
    return NextResponse.json({ ok: false, error: "Couldn't create the login." }, { status: 500 });
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: created.user.id,
    login_id: d.loginId,
    full_name: d.fullName,
    role: d.role,
    permissions: d.role === "admin" ? d.permissions ?? [] : [],
    phone: d.phone || null,
    upi_id: d.upiId || null,
    created_by: me.id,
  });
  if (profileError) {
    await supabase.auth.admin.deleteUser(created.user.id); // don't leave a login without a profile
    console.error("[users] profile insert failed", profileError);
    return NextResponse.json({ ok: false, error: "Couldn't save the user." }, { status: 500 });
  }

  await audit(me.id, "USER_CREATED", "profile", created.user.id, null, { loginId: d.loginId, role: d.role });
  // The password is returned once so the admin can hand it over; it is never stored or shown again.
  return NextResponse.json({ ok: true, user: { id: created.user.id, loginId: d.loginId }, password });
}
