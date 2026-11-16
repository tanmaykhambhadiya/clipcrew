import { z } from "zod";
import { sql } from "@/db/pool";
import { guard, ok, parseBody, staffCampaignIds } from "@/lib/portal/guard";
import { audit } from "@/lib/portal/session";

const schema = z.object({
  action: z.literal("approve"),
  ids: z.array(z.uuid()).min(1, "Select at least one submission.").max(200, "Approve up to 200 at a time."),
});

// POST /api/admin/submissions/bulk — approve many pending submissions at once
// (only those in campaigns this person works on).
export async function POST(req: Request) {
  const g = await guard({ permission: "submissions.review" });
  if ("error" in g) return g.error;
  const body = await parseBody(req, schema);
  if ("error" in body) return body.error;

  const scope = await staffCampaignIds(g.me);
  const params: unknown[] = [g.me.id, body.data.ids];
  let scopeSql = "";
  if (scope) {
    if (!scope.length) return ok({ approved: 0 });
    scopeSql = `and campaign_id = any($${params.push(scope)})`;
  }
  const rows = await sql<{ id: string }>(
    `update submissions set status = 'approved', reviewed_by = $1, reviewed_at = now(), reject_reason = null
      where id = any($2) and status = 'pending' ${scopeSql} returning id`,
    params,
  );
  if (rows.length) await audit(g.me.id, "SUBMISSIONS_APPROVED", "submission", null, null, { count: rows.length, ids: rows.map((r) => r.id) });
  return ok({ approved: rows.length });
}
