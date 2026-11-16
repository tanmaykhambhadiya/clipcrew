import { guard, ok } from "@/lib/portal/guard";
import { loadClipperCampaigns } from "@/loaders/portalCampaigns";

// GET /api/pages/portal/campaigns — the signed-in clipper's campaigns + their accounts.
export async function GET() {
  const g = await guard({ clipper: true });
  if ("error" in g) return g.error;
  return ok(await loadClipperCampaigns(g.me.id));
}
