import { z } from "zod";
import { canAccessCampaign, fail, guard, ok } from "@/lib/portal/guard";
import { reelKey } from "@/lib/portal/reelUrl";
import { canUseNoticesPage } from "@/loaders/rejections";
import { findPriorRejection, findSubmissionByKey } from "@/loaders/reelStatus";

// GET /api/admin/rejections/lookup?url=&clipper= — what we already know about a reel link:
// the clip submission it belongs to (so the form can fill in clipper + campaign) and whether it was
// already rejected. Used by the "Reject a reel" form as soon as a link is pasted.
export async function GET(req: Request) {
  const g = await guard({ staff: true });
  if ("error" in g) return g.error;
  const { me } = g;
  if (!canUseNoticesPage(me)) return fail(403, "You don't have permission to do that.");

  const url = new URL(req.url);
  const link = (url.searchParams.get("url") || "").trim();
  const clipper = url.searchParams.get("clipper") || "";
  if (!link || link.length > 500) return ok({ key: null, submission: null, priorRejection: null });
  if (clipper && !z.uuid().safeParse(clipper).success) return fail(400, "Unknown clipper.");

  const key = reelKey(link);
  let submission = key ? await findSubmissionByKey(key) : null;
  if (submission && !(await canAccessCampaign(me, submission.campaignId))) submission = null; // not theirs to see

  const who = submission?.clipperId ?? clipper;
  const priorRejection = who ? await findPriorRejection(who, key ?? link) : null;
  return ok({ key, submission, priorRejection });
}
