import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { PERMISSION_KEYS } from "@/lib/portal/permissions";
import { generatePassword, hashPassword } from "@/lib/portal/password";
import { audit, can, endAllSessions, getMe, isStaff } from "@/lib/portal/session";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reset_password"), password: z.string().min(8).max(100).optional() }),
  z.object({ action: z.literal("terminate"), reason: z.string().trim().min(1, "Give a reason").max(300) }),
  z.object({ action: z.literal("reactivate") }),
  z.object({ action: z.literal("set_permissions"), permissions: z.array(z.enum(PERMISSION_KEYS as [string, ...string[]])) }),
]);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const me = await getMe();
  if (!me || !isStaff(me)) return NextResponse.json({ ok: false }, { status: 403 });

  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  const body = parsed.data;

  const supabase = getSupabaseAdmin();
  const { data: target } = await supabase
    .from("profiles")
    .select("id, login_id, role, status, permissions")
    .eq("id", params.id)
    .maybeSingle();
  if (!target) return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });

  const isSuper = me.role === "super_admin";
  const forbidden = (error = "You don't have permission to do that.") => NextResponse.json({ ok: false, error }, { status: 403 });

  // Nobody changes a super admin through this route, and nobody acts on themselves destructively.
  if (target.role === "super_admin" && body.action !== "reset_password") return forbidden("The super admin can't be changed here.");
  if (target.role === "super_admin" && target.id !== me.id) return forbidden();

  switch (body.action) {
    case "reset_password": {
      // clippers: anyone with users.create; staff: super admin; own password: anyone signed in
      const own = target.id === me.id;
      const allowed = own || (target.role === "clipper" ? can(me, "users.create") : isSuper);
      if (!allowed) return forbidden();
      const password = body.password ?? generatePassword();
      const { error } = await supabase
        .from("credentials")
        .upsert({ user_id: target.id, password_hash: await hashPassword(password), updated_at: new Date().toISOString() });
      if (error) return NextResponse.json({ ok: false, error: "Couldn't reset the password." }, { status: 500 });
      await endAllSessions(target.id, { keepCurrent: own }); // old password's sessions stop working
      await audit(me.id, "PASSWORD_RESET", "profile", target.id);
      return NextResponse.json({ ok: true, password });
    }
    case "terminate": {
      if (!isSuper) return forbidden("Only the super admin can terminate users.");
      if (target.id === me.id) return forbidden("You can't terminate yourself.");
      const { error } = await supabase
        .from("profiles")
        .update({ status: "terminated", terminated_at: new Date().toISOString(), termination_reason: body.reason })
        .eq("id", target.id);
      if (error) return NextResponse.json({ ok: false, error: "Couldn't terminate the user." }, { status: 500 });
      // Sign them out everywhere; login refuses terminated users and getMe() blocks every request.
      await endAllSessions(target.id);
      await audit(me.id, "USER_TERMINATED", "profile", target.id, { status: target.status }, { status: "terminated", reason: body.reason });
      return NextResponse.json({ ok: true });
    }
    case "reactivate": {
      if (!isSuper) return forbidden("Only the super admin can reactivate users.");
      const { error } = await supabase
        .from("profiles")
        .update({ status: "active", terminated_at: null, termination_reason: null })
        .eq("id", target.id);
      if (error) return NextResponse.json({ ok: false, error: "Couldn't reactivate the user." }, { status: 500 });
      await audit(me.id, "USER_REACTIVATED", "profile", target.id, { status: target.status }, { status: "active" });
      return NextResponse.json({ ok: true });
    }
    case "set_permissions": {
      if (!isSuper) return forbidden("Only the super admin can change permissions.");
      if (target.role !== "admin") return NextResponse.json({ ok: false, error: "Permissions apply to staff only." }, { status: 400 });
      const { error } = await supabase.from("profiles").update({ permissions: body.permissions }).eq("id", target.id);
      if (error) return NextResponse.json({ ok: false, error: "Couldn't save permissions." }, { status: 500 });
      await audit(me.id, "PERMISSIONS_CHANGED", "profile", target.id, { permissions: target.permissions }, { permissions: body.permissions });
      return NextResponse.json({ ok: true });
    }
  }
}
