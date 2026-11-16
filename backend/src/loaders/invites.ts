import { randomBytes } from "node:crypto";
import { sql, sqlOne } from "@/db/pool";

export const newInviteToken = () => randomBytes(12).toString("base64url"); // 16 chars, unguessable

export type InviteRow = {
  id: string;
  token: string;
  label: string;
  campaign_ids: string[];
  max_uses: number | null;
  uses: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
  created_by_id: string;
};

/** Why a link can't be used right now, or null if it can. */
export function inviteProblem(i: Pick<InviteRow, "active" | "max_uses" | "uses" | "expires_at">): string | null {
  if (!i.active) return "This invite link has been turned off.";
  if (i.expires_at && new Date(i.expires_at).getTime() <= Date.now()) return "This invite link has expired.";
  if (i.max_uses !== null && i.uses >= i.max_uses) return "This invite link has been used up.";
  return null;
}

export const findInviteByToken = (token: string) =>
  /^[A-Za-z0-9_-]{10,40}$/.test(token)
    ? sqlOne<InviteRow>(
        "select id, token, label, campaign_ids, max_uses, uses, active, expires_at, created_at, created_by as created_by_id from invite_links where token = $1",
        [token],
      )
    : Promise.resolve(null);

export async function campaignNames(ids: string[]): Promise<{ id: string; name: string; status: string }[]> {
  if (!ids.length) return [];
  return sql("select id, name, status from campaigns where id = any($1) order by name", [ids]);
}
