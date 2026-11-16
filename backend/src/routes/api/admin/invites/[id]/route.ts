import { z } from "zod";
import { sql } from "@/db/pool";
import { fail, guard, ok, parseBody } from "@/lib/portal/guard";
import { audit } from "@/lib/portal/session";
import { newInviteToken } from "@/loaders/invites";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set_active"), active: z.boolean() }),
  z.object({ action: z.literal("new_token") }), // the old link stops working, a new URL replaces it
]);

// PATCH /api/admin/invites/:id — turn a link off/on, or replace its URL.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await guard({ superAdmin: true });
  if ("error" in g) return g.error;
  if (!UUID.test(params.id)) return fail(404, "Invite link not found.");
  const p = await parseBody(req, schema);
  if ("error" in p) return p.error;
  const d = p.data;
  const rows =
    d.action === "set_active"
      ? await sql("update invite_links set active = $2 where id = $1 returning id, token", [params.id, d.active])
      : await sql("update invite_links set token = $2 where id = $1 returning id, token", [params.id, newInviteToken()]);
  if (!rows.length) return fail(404, "Invite link not found.");
  await audit(g.me.id, d.action === "set_active" ? (d.active ? "INVITE_ENABLED" : "INVITE_DISABLED") : "INVITE_URL_REPLACED", "invite_link", params.id);
  return ok({ token: rows[0].token });
}
