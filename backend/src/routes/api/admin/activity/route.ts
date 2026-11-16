import { z } from "zod";
import { fail, guard, ok } from "@/lib/portal/guard";
import { loadActivity } from "./load";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  action: z
    .string()
    .regex(/^[A-Z0-9_]{1,60}$/)
    .optional(),
  actor: z.uuid().optional(),
});

// GET /api/admin/activity?offset=&action=&actor= — audit log, newest first, 100 per page (audit.view).
export async function GET(req: Request) {
  const g = await guard({ permission: "audit.view" });
  if ("error" in g) return g.error;

  const sp = new URL(req.url).searchParams;
  const parsed = querySchema.safeParse({
    offset: sp.get("offset") ?? undefined,
    action: sp.get("action") || undefined,
    actor: sp.get("actor") || undefined,
  });
  if (!parsed.success) return fail(400, "Those filters don't look right.");

  try {
    const page = await loadActivity(parsed.data);
    return ok(page);
  } catch (e) {
    console.error("[activity] load failed", e);
    return fail(500, "Couldn't load the activity log.");
  }
}
