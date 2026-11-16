import { guard, ok } from "@/lib/portal/guard";
import { loadEarningsPayload } from "@/loaders/earnings";

// GET /api/pages/portal/earnings — the signed-in clipper's weekly earnings rows, accounts, campaigns and balance.
export async function GET() {
  const g = await guard({ clipper: true });
  if ("error" in g) return g.error;
  return ok(await loadEarningsPayload(g.me.id));
}
