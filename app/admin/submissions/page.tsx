import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { can, getMe } from "@/lib/portal/session";
import { pageApi } from "@/lib/server-api";
import { EmptyState, PageTitle, field, smallBtn } from "@/components/portal/ui";
import { SubmissionsQueue, type QueueSubmission } from "./SubmissionsQueue";

export const dynamic = "force-dynamic";

const TABS = ["pending", "approved", "rejected", "all"] as const;
type Tab = (typeof TABS)[number];
const LABEL: Record<Tab, string> = { pending: "Pending", approved: "Approved", rejected: "Rejected", all: "All" };

export default async function AdminSubmissionsPage({ searchParams }: { searchParams: { status?: string; campaign?: string; q?: string } }) {
  const me = await getMe();
  if (!me || !can(me, "submissions.review")) redirect("/admin");

  const tab: Tab = (TABS as readonly string[]).includes(searchParams.status ?? "") ? (searchParams.status as Tab) : "pending";
  const campaign = searchParams.campaign ?? "";
  const q = (searchParams.q ?? "").slice(0, 60);

  const qs = new URLSearchParams({ status: tab });
  if (campaign) qs.set("campaign", campaign);
  if (q) qs.set("q", q);
  const data = await pageApi<{
    rows: QueueSubmission[];
    counts: { pending: number; approved: number; rejected: number };
    campaigns: { id: string; name: string }[];
    truncated: boolean;
  }>(`/api/admin/submissions?${qs}`);

  const href = (t: Tab) => {
    const p = new URLSearchParams();
    if (t !== "pending") p.set("status", t);
    if (campaign) p.set("campaign", campaign);
    if (q) p.set("q", q);
    const s = p.toString();
    return `/admin/submissions${s ? `?${s}` : ""}`;
  };
  const count = (t: Tab) => (t === "all" ? data.counts.pending + data.counts.approved + data.counts.rejected : data.counts[t]);
  const filtered = !!(campaign || q);

  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Submissions" line1="Review the reels" line2="approve what's on brief." />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <nav className="flex flex-wrap gap-2" aria-label="Filter by status">
          {TABS.map((t) => (
            <Link
              key={t}
              href={href(t)}
              aria-current={t === tab ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
                t === tab ? "border-lime bg-lime font-bold text-ink" : "border-line text-muted-dark hover:border-lime hover:text-lime",
              )}
            >
              {LABEL[t]} <span className="font-mono text-xs opacity-70">{count(t)}</span>
            </Link>
          ))}
        </nav>
        <form method="get" className="flex flex-col gap-2 sm:flex-row" role="search">
          <input type="hidden" name="status" value={tab} />
          <div className="relative">
            <label htmlFor="sq" className="sr-only">Search</label>
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-dark" aria-hidden />
            <input id="sq" name="q" defaultValue={q} className={`${field} pl-9 sm:w-60`} placeholder="Link, @handle or clipper" />
          </div>
          <label htmlFor="sc" className="sr-only">Campaign</label>
          <select id="sc" name="campaign" defaultValue={campaign} className={`${field} sm:w-48`}>
            <option value="">All campaigns</option>
            {data.campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button type="submit" className={smallBtn}>Filter</button>
            {filtered && <Link href={href(tab).split("?")[0] + (tab !== "pending" ? `?status=${tab}` : "")} className={smallBtn}>Clear</Link>}
          </div>
        </form>
      </div>

      {data.rows.length === 0 ? (
        <EmptyState title={filtered ? "Nothing matches." : tab === "pending" ? "All caught up." : "Nothing here yet."}>
          {tab === "pending" && !filtered ? "New submissions from clippers show up here for review." : "Try another tab or clear the filters."}
        </EmptyState>
      ) : (
        <SubmissionsQueue rows={data.rows} tab={tab} canFine={can(me, "fines.create")} truncated={data.truncated} />
      )}
    </div>
  );
}
