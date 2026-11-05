import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";

// Server-side read helpers for the campaign screens. The service-role client ignores RLS, so every
// caller is responsible for scoping (staffCampaignIds / canAccessCampaign) before using these.

const PAGE = 1000; // PostgREST's default max rows per request

type PagedQuery = (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>;

/** Reads every row of a query, 1000 at a time. */
export async function fetchAll<T>(query: PagedQuery): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/** Runs an `.in()` lookup in chunks so long id lists don't overflow the URL. */
export async function fetchIn<T>(ids: string[], query: (chunk: string[], from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const unique = Array.from(new Set(ids));
  const out: T[] = [];
  for (let i = 0; i < unique.length; i += 150) {
    const chunk = unique.slice(i, i + 150);
    out.push(...(await fetchAll<T>((from, to) => query(chunk, from, to))));
  }
  return out;
}

export type CampaignRow = {
  id: string;
  name: string;
  client: string | null;
  rate_per_million_paise: number;
  allowed_platforms: string[];
  max_accounts_per_clipper: number;
  status: "draft" | "active" | "paused" | "ended";
  starts_on: string | null;
  ends_on: string | null;
  created_at: string;
};

export const CAMPAIGN_COLUMNS =
  "id, name, client, rate_per_million_paise, allowed_platforms, max_accounts_per_clipper, status, starts_on, ends_on, created_at";

export type ViewRow = { campaign_id: string; account_id: string; week_start: string; views: number; amount_paise: number };

/** All weekly_views rows for the given campaigns. */
export function weeklyViewsFor(campaignIds: string[]) {
  const db = getSupabaseAdmin();
  return fetchIn<ViewRow>(campaignIds, (chunk, from, to) =>
    db
      .from("weekly_views")
      .select("campaign_id, account_id, week_start, views, amount_paise")
      .in("campaign_id", chunk)
      .order("id")
      .range(from, to),
  );
}
