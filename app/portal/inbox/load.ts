import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";

export const INBOX_PAGE_SIZE = 50;

export type InboxItem = {
  id: string;
  kind: "reel_rejected" | "fine" | "account_verified" | "account_rejected" | "payout" | "info";
  title: string;
  body: string | null;
  reelRef: string | null;
  campaignName: string | null;
  createdAt: string;
  readAt: string | null;
};

/** Cursor = "<created_at>|<id>" of the last item already shown. */
export function encodeCursor(item: { createdAt: string; id: string }) {
  return `${item.createdAt}|${item.id}`;
}

const ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:?\d{2})?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One page of a clipper's notifications, newest first. Always scoped to `clipperId`. */
export async function loadInbox(clipperId: string, cursor?: string | null) {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("notifications")
    .select("id, kind, title, body, reel_ref, campaign_id, created_at, read_at")
    .eq("clipper_id", clipperId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(INBOX_PAGE_SIZE + 1);

  if (cursor) {
    const [at, id] = cursor.split("|");
    if (!at || !id || !ISO.test(at) || !UUID.test(id)) throw new Error("bad cursor");
    // Values are validated above, so they are safe inside the PostgREST filter (quoted for the timestamp's ':' and '+').
    q = q.or(`created_at.lt."${at}",and(created_at.eq."${at}",id.lt.${id})`);
  }

  const { data, error } = await q;
  if (error) throw error;
  type Row = {
    id: string;
    kind: InboxItem["kind"];
    title: string;
    body: string | null;
    reel_ref: string | null;
    campaign_id: string | null;
    created_at: string;
    read_at: string | null;
  };
  const rows = (data ?? []) as Row[];
  const hasMore = rows.length > INBOX_PAGE_SIZE;
  const page = rows.slice(0, INBOX_PAGE_SIZE);

  const cIds = Array.from(new Set(page.map((r) => r.campaign_id).filter((x): x is string => !!x)));
  const names = new Map<string, string>();
  if (cIds.length) {
    const { data: cs } = await sb.from("campaigns").select("id, name").in("id", cIds);
    for (const c of (cs ?? []) as { id: string; name: string }[]) names.set(c.id, c.name);
  }

  const items: InboxItem[] = page.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    reelRef: r.reel_ref,
    campaignName: r.campaign_id ? names.get(r.campaign_id) ?? null : null,
    createdAt: r.created_at,
    readAt: r.read_at,
  }));
  return { items, nextCursor: hasMore && items.length ? encodeCursor(items[items.length - 1]) : null };
}
