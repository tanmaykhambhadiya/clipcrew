import { fail, guard, ok } from "@/lib/portal/guard";
import { loadClipperCampaigns } from "@/app/portal/campaigns/data";

// GET /api/portal/campaigns — campaigns this clipper is in, with their linked accounts and earnings.
export async function GET() {
  const g = await guard({ clipper: true });
  if ("error" in g) return g.error;
  const res = await loadClipperCampaigns(g.me.id);
  if (res.error) return fail(500, res.error);
  return ok({ campaigns: res.campaigns, accounts: res.accounts });
}
