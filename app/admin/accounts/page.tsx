import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { can, getMe } from "@/lib/portal/session";
import { formatDate } from "@/lib/portal/weeks";
import { EmptyState, ErrorNote, PLATFORM_LABELS, PageTitle, Pill, TableWrap, field, smallBtn, td, th, tr } from "@/components/portal/ui";
import { profileUrl } from "@/app/portal/accounts/handle";
import { ACCOUNT_TABS, loadAccountQueue, type AccountTab } from "./query";
import { AccountActions } from "./AccountActions";

export const dynamic = "force-dynamic";

const TAB_LABELS: Record<AccountTab, string> = { pending: "Pending", verified: "Verified", rejected: "Rejected", all: "All" };
const STATUS_TONE = { pending: "amber", verified: "lime", rejected: "red" } as const;

export default async function AdminAccountsPage({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  const me = await getMe();
  if (!me || !can(me, "accounts.verify")) redirect("/admin");

  const tab: AccountTab = (ACCOUNT_TABS as readonly string[]).includes(searchParams.status ?? "") ? (searchParams.status as AccountTab) : "pending";
  const q = (searchParams.q ?? "").slice(0, 60);
  const { rows, counts, error, truncated } = await loadAccountQueue(tab, q);
  const isSuper = me.role === "super_admin";

  const href = (t: AccountTab) => {
    const p = new URLSearchParams();
    if (t !== "pending") p.set("status", t);
    if (q) p.set("q", q);
    const s = p.toString();
    return `/admin/accounts${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Accounts" line1="Account checks" line2="code in bio? verify it." />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <nav className="flex flex-wrap gap-2" aria-label="Filter by status">
          {ACCOUNT_TABS.map((t) => (
            <Link
              key={t}
              href={href(t)}
              aria-current={t === tab ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
                t === tab ? "border-lime bg-lime text-ink font-bold" : "border-line text-muted-dark hover:border-lime hover:text-lime",
              )}
            >
              {TAB_LABELS[t]}
              {t !== "all" && <span className={cn("font-mono text-xs", t === tab ? "text-ink/70" : "text-muted-dark/70")}>{counts[t]}</span>}
            </Link>
          ))}
        </nav>
        <form action="/admin/accounts" method="get" className="flex w-full gap-2 lg:w-auto" role="search">
          {tab !== "pending" && <input type="hidden" name="status" value={tab} />}
          <label htmlFor="acc-q" className="sr-only">
            Search by username or clipper
          </label>
          <input id="acc-q" name="q" defaultValue={q} placeholder="Username, clipper name or login ID" className={cn(field, "lg:w-72")} />
          <button type="submit" className={cn(smallBtn, "shrink-0 px-4")} aria-label="Search">
            <Search size={14} /> Search
          </button>
        </form>
      </div>

      {q && (
        <p className="text-sm text-muted-dark">
          Results for <span className="text-cream">&ldquo;{q}&rdquo;</span> ·{" "}
          <Link href={href(tab)} className="text-lime underline-offset-4 hover:underline" prefetch={false}>
            clear
          </Link>
        </p>
      )}

      <ErrorNote>{error}</ErrorNote>

      {rows.length === 0 && !error ? (
        <EmptyState title={q ? "No matches" : tab === "pending" ? "Queue's clear" : "Nothing here yet"}>
          {q ? "Try another username or clipper name." : tab === "pending" ? "No accounts are waiting for a check. New ones show up here as clippers add them." : "Accounts will appear here once they're reviewed."}
        </EmptyState>
      ) : (
        <TableWrap minWidth={900}>
          <thead>
            <tr className={tr}>
              <th className={th}>Clipper</th>
              <th className={th}>Account</th>
              <th className={th}>Code to look for</th>
              <th className={th}>Submitted</th>
              <th className={th}>Status</th>
              <th className={th}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const link = profileUrl(r.platform, r.username);
              return (
                <tr key={r.id} className={tr}>
                  <td className={td}>
                    <p className="font-medium">{r.clipper?.full_name ?? "Unknown"}</p>
                    <p className="font-mono text-xs text-muted-dark">{r.clipper?.login_id}</p>
                    {r.clipper?.status === "terminated" && (
                      <span className="mt-1 inline-block">
                        <Pill tone="grey">terminated</Pill>
                      </span>
                    )}
                  </td>
                  <td className={td}>
                    <p className="text-xs text-muted-dark">{PLATFORM_LABELS[r.platform] ?? r.platform}</p>
                    <p className="font-mono">@{r.username}</p>
                    {link ? (
                      <a href={link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-lime underline-offset-4 hover:underline">
                        Open profile <ExternalLink size={12} aria-hidden />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    ) : (
                      <p className="mt-1 text-xs text-muted-dark">No link for this platform — search manually.</p>
                    )}
                  </td>
                  <td className={td}>
                    <span className="rounded-lg bg-ink px-2.5 py-1 font-mono text-sm tracking-wider text-cream">{r.verify_code}</span>
                  </td>
                  <td className={td}>{formatDate(r.created_at)}</td>
                  <td className={td}>
                    <Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill>
                    {r.status === "verified" && (
                      <p className="mt-1 text-xs text-muted-dark">
                        {formatDate(r.verified_at)}
                        {r.verifier ? ` · ${r.verifier.full_name}` : ""}
                      </p>
                    )}
                  </td>
                  <td className={`${td} text-right`}>
                    <AccountActions id={r.id} handle={`@${r.username}`} status={r.status} isSuper={isSuper} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
      {truncated && <p className="text-xs text-muted-dark">Showing the first 300. Use search to narrow it down.</p>}
    </div>
  );
}
