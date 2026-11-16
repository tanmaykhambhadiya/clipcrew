import { z } from "zod";
import { sqlOne, tx } from "@/db/pool";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { fail, notify, ok, parseBody } from "@/lib/portal/guard";
import { generatePassword, hashPassword } from "@/lib/portal/password";
import { seal } from "@/lib/portal/secretBox";
import { audit, startSession } from "@/lib/portal/session";
import { campaignNames, findInviteByToken, inviteProblem } from "@/loaders/invites";

// Public. GET /api/join/:token — is this invite link usable, and which campaigns does it add you to?
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const invite = await findInviteByToken(params.token);
  if (!invite) return fail(404, "This invite link doesn't exist. Ask for a new one.");
  const problem = inviteProblem(invite);
  if (problem) return fail(410, `${problem} Ask for a new one.`);
  const campaigns = (await campaignNames(invite.campaign_ids)).filter((c) => c.status !== "ended").map((c) => c.name);
  return ok({ label: invite.label, campaigns });
}

const schema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80, "Keep it under 80 characters"),
  loginId: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,30}$/, "3–30 characters: letters, numbers, . _ -"),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{8,20}$/, "Enter your WhatsApp number"),
  upiId: z
    .string()
    .trim()
    .max(80)
    .regex(/^$|^[\w.-]{2,}@[\w.-]{2,}$/, "That doesn't look like a UPI ID (name@bank)")
    .optional(),
  website: z.string().max(0).optional(), // honeypot: people never fill it in
});

// Public. POST /api/join/:token — create a clipper account from an invite link, join its campaigns,
// sign them in, and return the generated password once (the super admin can also look it up).
export async function POST(req: Request, { params }: { params: { token: string } }) {
  if (!rateLimit("join", clientIp(req))) return fail(429, "Too many sign-ups from this network. Try again in a few minutes.");
  const p = await parseBody(req, schema);
  if ("error" in p) return p.error;
  const d = p.data;

  const invite = await findInviteByToken(params.token);
  if (!invite) return fail(404, "This invite link doesn't exist. Ask for a new one.");
  const problem = inviteProblem(invite);
  if (problem) return fail(410, `${problem} Ask for a new one.`);

  if (await sqlOne("select 1 as x from profiles where login_id = $1", [d.loginId]))
    return fail(409, "That login ID is taken — try another.", { loginId: "Already taken" });

  const password = generatePassword();
  const hash = await hashPassword(password);
  let userId: string;
  try {
    userId = await tx(async (q) => {
      // claim one use atomically, so a link with 10 uses can't create 11 accounts
      const claimed = await q(
        `update invite_links set uses = uses + 1
          where id = $1 and active and (max_uses is null or uses < max_uses) and (expires_at is null or expires_at > now())
          returning campaign_ids`,
        [invite.id],
      );
      if (!claimed.length) throw new Error("INVITE_GONE");
      const [u] = await q<{ id: string }>(
        `insert into profiles (login_id, full_name, role, phone, upi_id, created_by, invite_id)
         values ($1, $2, 'clipper', $3, $4, $5, $6) returning id`,
        [d.loginId, d.fullName, d.phone, d.upiId || null, invite.created_by_id ?? null, invite.id],
      );
      await q("insert into credentials (user_id, password_hash, visible_password) values ($1, $2, $3)", [u.id, hash, seal(password)]);
      await q(
        `insert into campaign_clippers (campaign_id, clipper_id)
         select c.id, $2 from campaigns c where c.id = any($1) and c.status <> 'ended' on conflict do nothing`,
        [claimed[0].campaign_ids, u.id],
      );
      return u.id;
    });
  } catch (e: any) {
    if (e?.message === "INVITE_GONE") return fail(410, "This invite link was just used up or turned off. Ask for a new one.");
    if (e?.code === "23505") return fail(409, "That login ID is taken — try another.", { loginId: "Already taken" });
    console.error("[join] sign-up failed", e);
    return fail(500, "Couldn't create your account. Please try again.");
  }

  await audit(userId, "USER_JOINED_VIA_INVITE", "profile", userId, null, { loginId: d.loginId, inviteId: invite.id, label: invite.label });
  await notify(userId, {
    kind: "info",
    title: "Welcome to ClipCrew 👋",
    body: "Next step: add your Instagram / YouTube account under Accounts. We'll send you a code to verify it, then you can start submitting reels.",
  });
  await startSession(userId);
  return ok({ loginId: d.loginId, password, redirect: "/portal" });
}
