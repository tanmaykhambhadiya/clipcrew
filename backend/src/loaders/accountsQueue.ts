import { getSupabaseAdmin } from "@/lib/supabase";
import { sql } from "@/db/pool";

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

  const params: unknown[] = [];
  const where: string[] = [];
  if (tab !== "all") where.push(`a.status = $${params.push(tab)}`);
  if (q) {
    const name = `%${q}%`;
    const user = `%${q.toLowerCase().replace(/s+/g, "")}%`;
    const n = params.push(name);
    const u = params.push(user);
    where.push(`(a.username ilike $${u} or cp.full_name ilike $${n} or cp.login_id ilike $${n})`);
  }
  // the queue works oldest-first; history views newest-first
  const text = `
    select a.id, a.platform, a.username, a.verify_code, a.status, a.created_at, a.verified_at,
           json_build_object('id', cp.id, 'full_name', cp.full_name, 'login_id', cp.login_id, 'status', cp.status) as clipper,
           case when v.id is null then null else json_build_object('full_name', v.full_name) end as verifier
      from social_accounts a
      join profiles cp on cp.id = a.clipper_id
      left join profiles v on v.id = a.verified_by
     ${where.length ? "where " + where.join(" and ") : ""}
     order by a.created_at ${tab === "pending" ? "asc" : "desc"}
     limit ${LIMIT}`;

  const [counts, rows] = await Promise.all([
    Promise.all(
      (["pending", "verified", "rejected"] as const).map((st) =>
        supabase.from("social_accounts").select("id", { count: "exact", head: true }).eq("status", st),
      ),
    ),
    sql<QueueRow>(text, params).then((data) => ({ data, error: null as null | string })).catch(() => ({ data: [] as QueueRow[], error: "Couldn't load accounts." })),
  ]);

  return {
    rows: rows.data,
    error: rows.error,
    truncated: rows.data.length >= LIMIT,
    counts: { pending: counts[0].count ?? 0, verified: counts[1].count ?? 0, rejected: counts[2].count ?? 0 },
  };
}
