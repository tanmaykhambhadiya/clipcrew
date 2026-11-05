import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";

export const ACCOUNT_TABS = ["pending", "verified", "rejected", "all"] as const;
export type AccountTab = (typeof ACCOUNT_TABS)[number];

export type QueueRow = {
  id: string;
  platform: string;
  username: string;
  verify_code: string;
  status: "pending" | "verified" | "rejected";
  created_at: string;
  verified_at: string | null;
  clipper: { id: string; full_name: string; login_id: string; status: string } | null;
  verifier: { full_name: string } | null;
};

const LIMIT = 300;

/** Strip characters that have meaning inside a PostgREST or() filter / ilike pattern. */
function clean(q: string) {
  return q.replace(/[%*,()\\:"'.]/g, " ").replace(/^@+/, "").trim().slice(0, 60);
}

export async function loadAccountQueue(tab: AccountTab, rawQ: string) {
  const supabase = getSupabaseAdmin();
  const q = clean(rawQ);

  let query = supabase
    .from("social_accounts")
    .select(
      "id, platform, username, verify_code, status, created_at, verified_at, clipper:profiles!social_accounts_clipper_id_fkey(id, full_name, login_id, status), verifier:profiles!social_accounts_verified_by_fkey(full_name)",
    )
    // the queue works oldest-first; history views newest-first
    .order("created_at", { ascending: tab === "pending" })
    .limit(LIMIT);
  if (tab !== "all") query = query.eq("status", tab);

  if (q) {
    const { data: people } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "clipper")
      .or(`full_name.ilike.%${q}%,login_id.ilike.%${q}%`)
      .limit(200);
    const ids = (people ?? []).map((p) => p.id);
    const u = q.toLowerCase().replace(/\s+/g, "");
    query = ids.length ? query.or(`username.ilike.%${u}%,clipper_id.in.(${ids.join(",")})`) : query.ilike("username", `%${u}%`);
  }

  const counts = await Promise.all(
    (["pending", "verified", "rejected"] as const).map((s) =>
      supabase.from("social_accounts").select("id", { count: "exact", head: true }).eq("status", s),
    ),
  );

  const { data, error } = await query;
  return {
    rows: (data ?? []) as unknown as QueueRow[],
    error: error ? "Couldn't load accounts." : null,
    truncated: (data?.length ?? 0) >= LIMIT,
    counts: { pending: counts[0].count ?? 0, verified: counts[1].count ?? 0, rejected: counts[2].count ?? 0 },
  };
}
