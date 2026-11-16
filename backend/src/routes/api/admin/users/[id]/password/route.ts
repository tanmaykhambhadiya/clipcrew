import { sqlOne } from "@/db/pool";
import { fail, guard, ok } from "@/lib/portal/guard";
import { open, secretBoxEnabled } from "@/lib/portal/secretBox";
import { audit } from "@/lib/portal/session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/admin/users/:id/password — super admin only: the clipper's current password, if ClipCrew
// issued it (created, reset or invite sign-up) and the clipper hasn't changed it since. Every view is logged.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await guard({ superAdmin: true });
  if ("error" in g) return g.error;
  if (!UUID.test(params.id)) return fail(404, "User not found.");
  const row = await sqlOne<{ role: string; login_id: string; visible_password: string | null; updated_at: string | null }>(
    `select p.role, p.login_id, c.visible_password, c.updated_at
       from profiles p left join credentials c on c.user_id = p.id where p.id = $1`,
    [params.id],
  );
  if (!row) return fail(404, "User not found.");
  if (row.role !== "clipper") return fail(403, "Only clipper passwords can be viewed.");
  if (!secretBoxEnabled()) return ok({ loginId: row.login_id, password: null, reason: "disabled" });
  const password = open(row.visible_password);
  if (password) await audit(g.me.id, "PASSWORD_VIEWED", "profile", params.id);
  return ok({ loginId: row.login_id, password, reason: password ? null : row.visible_password ? "key_changed" : "changed_by_clipper" });
}
