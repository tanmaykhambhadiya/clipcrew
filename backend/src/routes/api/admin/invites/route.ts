import { z } from "zod";
import { sql } from "@/db/pool";
import { fail, guard, ok, parseBody } from "@/lib/portal/guard";
import { audit } from "@/lib/portal/session";
import { inviteProblem, newInviteToken } from "@/loaders/invites";

// GET /api/admin/invites — super admin: every invite link, newest first, with who joined through it.
export async function GET() {
  const g = await guard({ superAdmin: true });
  if ("error" in g) return g.error;
  const [links, campaigns] = await Promise.all([
    sql<any>(
      `select i.id, i.token, i.label, i.campaign_ids, i.max_uses, i.uses, i.active, i.expires_at, i.created_at,
              coalesce((select json_agg(json_build_object('id', p.id, 'name', p.full_name, 'loginId', p.login_id, 'joinedAt', p.created_at) order by p.created_at desc)
                          from (select * from profiles where invite_id = i.id order by created_at desc limit 50) p), '[]') as joined
         from invite_links i order by i.created_at desc limit 200`,
    ),
    sql<any>("select id, name, status from campaigns where status <> 'ended' order by created_at desc"),
  ]);
  return ok({
    links: links.map((l) => ({
      id: l.id,
      token: l.token,
      label: l.label,
      campaignIds: l.campaign_ids,
      maxUses: l.max_uses,
      uses: l.uses,
      active: l.active,
      expiresAt: l.expires_at,
      createdAt: l.created_at,
      problem: inviteProblem(l),
      joined: l.joined,
    })),
    campaigns,
  });
}

const createSchema = z.object({
  label: z.string().trim().min(2, "Give the link a name, e.g. \"Instagram batch — Nov\"").max(80, "Keep it under 80 characters"),
  campaignIds: z.array(z.uuid()).max(20).default([]),
  maxUses: z.number().int().min(1, "At least 1").max(10000).nullable().optional(),
  expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
});

// POST /api/admin/invites — create a link. New clippers who use it join the chosen campaigns.
export async function POST(req: Request) {
  const g = await guard({ superAdmin: true });
  if ("error" in g) return g.error;
  const p = await parseBody(req, createSchema);
  if ("error" in p) return p.error;
  const d = p.data;
  if (d.campaignIds.length) {
    const found = await sql<{ id: string }>("select id from campaigns where id = any($1)", [d.campaignIds]);
    if (found.length !== new Set(d.campaignIds).size) return fail(400, "One of those campaigns no longer exists.", { campaignIds: "Unknown campaign" });
  }
  const expiresAt = d.expiresInDays ? new Date(Date.now() + d.expiresInDays * 86_400_000).toISOString() : null;
  const [row] = await sql<{ id: string; token: string }>(
    `insert into invite_links (token, label, campaign_ids, max_uses, expires_at, created_by)
     values ($1, $2, $3, $4, $5, $6) returning id, token`,
    [newInviteToken(), d.label, [...new Set(d.campaignIds)], d.maxUses ?? null, expiresAt, g.me.id],
  );
  await audit(g.me.id, "INVITE_CREATED", "invite_link", row.id, null, { label: d.label, campaignIds: d.campaignIds, maxUses: d.maxUses ?? null, expiresAt });
  return ok({ id: row.id, token: row.token });
}
