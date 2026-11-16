import { sql, sqlOne } from "@/db/pool";
import { reelKey } from "@/lib/portal/reelUrl";

// Keeps "Submissions" and "Rejections & fines" in sync: both look up a reel by its normalised key,
// so the same reel is recognised however its link was pasted (share params, www., reel/ vs p/).

export type ReelSubmission = {
  id: string;
  status: "pending" | "approved" | "rejected";
  clipperId: string;
  clipperName: string;
  campaignId: string;
  campaignName: string;
  createdAt: string;
  reviewedAt: string | null;
  rejectReason: string | null;
};
export type PriorRejection = { id: string; createdAt: string; title: string; byName: string | null };

export async function findSubmissionByKey(key: string): Promise<ReelSubmission | null> {
  const r = await sqlOne<any>(
    `select s.id, s.status, s.clipper_id, p.full_name, s.campaign_id, c.name as campaign_name, s.created_at, s.reviewed_at, s.reject_reason
       from submissions s join profiles p on p.id = s.clipper_id join campaigns c on c.id = s.campaign_id
      where s.url_key = $1`,
    [key],
  );
  if (!r) return null;
  return {
    id: r.id,
    status: r.status,
    clipperId: r.clipper_id,
    clipperName: r.full_name,
    campaignId: r.campaign_id,
    campaignName: r.campaign_name,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
    rejectReason: r.reject_reason,
  };
}

/** A "reel rejected" notice this clipper already got for the same reel (sent from either screen). */
export async function findPriorRejection(clipperId: string, key: string): Promise<PriorRejection | null> {
  const rows = await sql<any>(
    `select n.id, n.created_at, n.title, n.reel_ref, p.full_name as by_name
       from notifications n left join profiles p on p.id = n.created_by
      where n.clipper_id = $1 and n.kind = 'reel_rejected' and n.reel_ref is not null
      order by n.created_at desc limit 1000`,
    [clipperId],
  );
  const hit = rows.find((r) => reelKey(r.reel_ref) === key || r.reel_ref.trim() === key);
  return hit ? { id: hit.id, createdAt: hit.created_at, title: hit.title, byName: hit.by_name } : null;
}

/** Status of many reels at once, for history lists. Map: key → submission id + status. */
export async function submissionStatusByKeys(keys: string[]): Promise<Map<string, { id: string; status: string }>> {
  const uniq = [...new Set(keys.filter(Boolean))];
  if (!uniq.length) return new Map();
  const rows = await sql<any>("select id, url_key, status from submissions where url_key = any($1)", [uniq]);
  return new Map(rows.map((r) => [r.url_key, { id: r.id, status: r.status }]));
}

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
