import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";

// Small data helpers shared by the CSV export route and the /admin overview.
// PostgREST returns at most 1000 rows per request, so everything here pages through.

const PAGE = 1000;
const ID_CHUNK = 150; // keeps `in.(...)` URLs well under length limits

type Row = Record<string, unknown>;
type RangeQuery = (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>;

/** Runs a range-able query until it returns a short page. Throws on error. */
export async function fetchAll<T = Row>(query: RangeQuery, limit = 100_000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < limit; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/** Fetches rows of `table` whose `column` is in `ids`, in chunks. */
export async function fetchByIds<T = Row>(table: string, columns: string, ids: string[], column = "id"): Promise<T[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const out: T[] = [];
  for (let i = 0; i < unique.length; i += ID_CHUNK) {
    const chunk = unique.slice(i, i + ID_CHUNK);
    const rows = await fetchAll<T>((from, to) =>
      getSupabaseAdmin().from(table).select(columns).in(column, chunk).range(from, to),
    );
    out.push(...rows);
  }
  return out;
}

/** Map of id → row. */
export function indexBy<T extends Row>(rows: T[], key = "id"): Map<string, T> {
  return new Map(rows.map((r) => [String(r[key]), r]));
}

/** Clipper ids that belong to any of these campaigns (null = all campaigns → returns null too). */
export async function clipperIdsForCampaigns(campaignIds: string[] | null): Promise<string[] | null> {
  if (campaignIds === null) return null;
  if (campaignIds.length === 0) return [];
  const rows = await fetchByIds<{ clipper_id: string }>("campaign_clippers", "clipper_id", campaignIds, "campaign_id");
  return Array.from(new Set(rows.map((r) => r.clipper_id)));
}

export type Balance = { clipper_id: string; earned_paise: number; fines_paise: number; paid_paise: number };

export const balanceOf = (b: Pick<Balance, "earned_paise" | "fines_paise" | "paid_paise"> | undefined) =>
  b ? Number(b.earned_paise) - Number(b.fines_paise) - Number(b.paid_paise) : 0;

/** Rows from the clipper_balances view, optionally limited to some clippers (null = all). */
export async function fetchBalances(clipperIds: string[] | null): Promise<Balance[]> {
  if (clipperIds === null) {
    return fetchAll<Balance>((from, to) =>
      getSupabaseAdmin().from("clipper_balances").select("clipper_id, earned_paise, fines_paise, paid_paise").range(from, to),
    );
  }
  return fetchByIds<Balance>("clipper_balances", "clipper_id, earned_paise, fines_paise, paid_paise", clipperIds, "clipper_id");
}
