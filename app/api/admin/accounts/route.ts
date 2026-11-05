import { fail, guard, ok } from "@/lib/portal/guard";
import { ACCOUNT_TABS, loadAccountQueue, type AccountTab } from "@/app/admin/accounts/query";

// GET /api/admin/accounts?status=pending|verified|rejected|all&q=search — the verification queue.
export async function GET(req: Request) {
  const g = await guard({ permission: "accounts.verify" });
  if ("error" in g) return g.error;
  const url = new URL(req.url);
  const s = url.searchParams.get("status") ?? "pending";
  const tab: AccountTab = (ACCOUNT_TABS as readonly string[]).includes(s) ? (s as AccountTab) : "pending";
  const res = await loadAccountQueue(tab, url.searchParams.get("q") ?? "");
  if (res.error) return fail(500, res.error);
  return ok({ accounts: res.rows, counts: res.counts, truncated: res.truncated });
}
