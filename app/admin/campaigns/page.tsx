import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState, ErrorNote, PLATFORM_LABELS, PageTitle, Pill, TableWrap, field, smallBtn, td, th, tr } from "@/components/portal/ui";
import { compactViews, formatINR, formatViews } from "@/lib/portal/money";
import { can, getMe, isStaff } from "@/lib/portal/session";
import { formatDate } from "@/lib/portal/weeks";
import { pageApi } from "@/lib/server-api";
import { CAMPAIGN_STATUSES, statusTone } from "./_lib/status";
import type { CampaignRow } from "./_lib/data";

export const dynamic = "force-dynamic";

const STATUSES = CAMPAIGN_STATUSES;

export default async function CampaignsPage({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  const me = await getMe();
  if (!me || !isStaff(me)) redirect("/login");
  const canManage = can(me, "campaigns.manage");

  const status = STATUSES.includes(searchParams.status as (typeof STATUSES)[number]) ? searchParams.status! : "";
  const q = (searchParams.q ?? "").trim().slice(0, 80);

  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  if (q) qs.set("q", q);
  const data = await pageApi<{ campaigns: CampaignRow[]; totals: Record<string, { views: number; earned: number; clippers: number }>; loadError: string; scoped: boolean }>(
    `/api/pages/admin/campaigns?${qs}`,
    { forbiddenTo: "/login" },
  );
  const { campaigns, loadError, scoped } = data;
  const totals = new Map(Object.entries(data.totals));

  const filtered = !!(status || q);
  const grand = Array.from(totals.values()).reduce((a, t) => ({ views: a.views + t.views, earned: a.earned + t.earned }), { views: 0, earned: 0 });

  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Campaigns" line1="Every campaign," line2="one place.">
        {canManage && (
          <Link href="/admin/campaigns/new" className={buttonClass({ size: "sm" })}>
            <Plus size={16} aria-hidden /> New campaign
          </Link>
        )}
      </PageTitle>

      {scoped && (
        <p className="text-sm text-muted-dark">You see the campaigns the super admin has assigned to you.</p>
      )}

      <form method="get" className="flex flex-col gap-2 sm:flex-row sm:items-center" role="search">
        <div className="relative flex-1">
          <label htmlFor="cq" className="sr-only">Search campaigns</label>
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-dark" aria-hidden />
          <input id="cq" name="q" defaultValue={q} className={`${field} pl-9`} placeholder="Search by campaign or client" />
        </div>
        <label htmlFor="cs" className="sr-only">Status</label>
        <select id="cs" name="status" defaultValue={status} className={`${field} sm:w-44`}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
        <div className="flex gap-2">
          <button type="submit" className={buttonClass({ size: "sm", variant: "secondary" })}>Filter</button>
          {filtered && <Link href="/admin/campaigns" className={smallBtn}>Clear</Link>}
        </div>
      </form>

      <ErrorNote>{loadError}</ErrorNote>

      {!loadError && campaigns.length === 0 ? (
        filtered ? (
          <EmptyState title="Nothing matches.">Try another search or status — or <Link href="/admin/campaigns" className="text-lime underline">clear the filters</Link>.</EmptyState>
        ) : scoped ? (
          <EmptyState title="No campaigns yet.">You haven&apos;t been assigned to any campaigns. Ask the super admin to add you to one.</EmptyState>
        ) : (
          <EmptyState title="No campaigns yet.">
            Create your first campaign, set the rate per 1M views, then add clippers and share it on WhatsApp.
            {canManage && (
              <span className="mt-5 block">
                <Link href="/admin/campaigns/new" className={buttonClass({ size: "sm" })}><Plus size={16} aria-hidden /> New campaign</Link>
              </span>
            )}
          </EmptyState>
        )
      ) : campaigns.length > 0 && (
        <>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark">
            {campaigns.length} campaign{campaigns.length === 1 ? "" : "s"} · {compactViews(grand.views)} views · {formatINR(grand.earned)} earned
          </p>
          <TableWrap minWidth={1080}>
            <thead>
              <tr className="border-b border-line">
                <th className={th}>Campaign</th>
                <th className={th}>Rate / 1M</th>
                <th className={th}>Status</th>
                <th className={th}>Dates</th>
                <th className={th}>Platforms</th>
                <th className={`${th} text-right`}>Max accts</th>
                <th className={`${th} text-right`}>Clippers</th>
                <th className={`${th} text-right`}>Views</th>
                <th className={`${th} text-right`}>Earned</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const t = totals.get(c.id) ?? { views: 0, earned: 0, clippers: 0 };
                return (
                  <tr key={c.id} className={`${tr} transition hover:bg-ink-2/60`}>
                    <td className={td}>
                      <Link href={`/admin/campaigns/${c.id}`} className="font-semibold text-cream underline-offset-4 hover:text-lime hover:underline focus-visible:text-lime">
                        {c.name}
                      </Link>
                      <p className="text-xs text-muted-dark">{c.client || "No client"}</p>
                    </td>
                    <td className={`${td} whitespace-nowrap font-mono`}>{formatINR(c.rate_per_million_paise)}</td>
                    <td className={td}><Pill tone={statusTone[c.status]}>{c.status}</Pill></td>
                    <td className={`${td} whitespace-nowrap text-xs text-muted-dark`}>
                      {c.starts_on || c.ends_on ? <>{formatDate(c.starts_on)} → {c.ends_on ? formatDate(c.ends_on) : "open"}</> : "No dates"}
                    </td>
                    <td className={`${td} max-w-[200px] text-xs text-muted-dark`}>
                      {c.allowed_platforms.map((p) => PLATFORM_LABELS[p] ?? p).join(", ")}
                    </td>
                    <td className={`${td} text-right font-mono`}>{c.max_accounts_per_clipper}</td>
                    <td className={`${td} text-right font-mono`}>{t.clippers}</td>
                    <td className={`${td} text-right font-mono`} title={formatViews(t.views)}>{compactViews(t.views)}</td>
                    <td className={`${td} whitespace-nowrap text-right font-mono text-lime`}>{formatINR(t.earned)}</td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        </>
      )}
    </div>
  );
}
