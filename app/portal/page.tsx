import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Check, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";
import { getMe } from "@/lib/portal/session";
import { compactViews, formatINR, formatViews } from "@/lib/portal/money";
import { addDays, currentWeekStart, formatWeek, recentWeeks } from "@/lib/portal/weeks";
import { Card, Label, PageTitle, PLATFORM_LABELS, TableWrap, td, th, tr } from "@/components/portal/ui";
import { EarningsFilters } from "@/components/portal/earnings/EarningsFilters";
import { ImpactBreakdown, type ImpactRow } from "@/components/portal/earnings/ImpactBreakdown";
import { TrendBars } from "@/components/portal/earnings/TrendBars";
import { accountLabel, loadBalance, loadClipperEarnings, type EarningRow } from "@/components/portal/earnings/data";

export const dynamic = "force-dynamic";

const RANGE_LABEL: Record<string, string> = { "4": "last 4 weeks", "12": "last 12 weeks", all: "all time" };
const CHART_MAX_WEEKS = 26;

const sum = (rows: EarningRow[], k: "amountPaise" | "views") => rows.reduce((s, r) => s + r[k], 0);

export default async function PortalHome({ searchParams }: { searchParams: { c?: string; r?: string } }) {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "clipper") redirect("/admin");

  const [{ rows, accounts, campaigns, joinedCampaignIds }, balance] = await Promise.all([
    loadClipperEarnings(me.id),
    loadBalance(me.id),
  ]);

  const campaignOptions = Array.from(campaigns.values()).sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, name: c.name }));
  const campaign = campaignOptions.some((c) => c.id === searchParams.c) ? (searchParams.c as string) : "";
  const range = searchParams.r === "12" || searchParams.r === "all" ? searchParams.r : "4";

  const scoped = campaign ? rows.filter((r) => r.campaignId === campaign) : rows;
  const thisWeek = currentWeekStart();

  // Current period and the previous period of the same length (for the ▲/▼ change).
  const n = range === "all" ? null : Number(range);
  const fromWeek = n ? addDays(thisWeek, -7 * (n - 1)) : null;
  const prevFrom = n && fromWeek ? addDays(fromWeek, -7 * n) : null;
  const inPeriod = fromWeek ? scoped.filter((r) => r.weekStart >= fromWeek) : scoped;
  const prevPeriod = fromWeek && prevFrom ? scoped.filter((r) => r.weekStart >= prevFrom && r.weekStart < fromWeek) : null;

  const earned = sum(inPeriod, "amountPaise");
  const views = sum(inPeriod, "views");
  const prevEarned = prevPeriod ? sum(prevPeriod, "amountPaise") : null;
  const change = prevEarned === null ? null : prevEarned === 0 ? (earned > 0 ? "new" : null) : ((earned - prevEarned) / prevEarned) * 100;

  // Weekly series for the trend chart.
  const byWeek = new Map<string, { amount: number; views: number }>();
  for (const r of scoped) {
    const w = byWeek.get(r.weekStart) ?? { amount: 0, views: 0 };
    w.amount += r.amountPaise;
    w.views += r.views;
    byWeek.set(r.weekStart, w);
  }
  let chartWeeks: string[];
  if (n) chartWeeks = recentWeeks(n).reverse();
  else {
    const earliest = scoped.reduce((m, r) => (r.weekStart < m ? r.weekStart : m), thisWeek);
    const count = Math.min(CHART_MAX_WEEKS, Math.round((Date.parse(thisWeek) - Date.parse(earliest)) / (7 * 86400000)) + 1);
    chartWeeks = recentWeeks(Math.max(count, 4)).reverse();
  }
  const trend = chartWeeks.map((w) => ({ weekStart: w, amountPaise: byWeek.get(w)?.amount ?? 0 }));

  // Breakdown by campaign / by account for the selected period.
  const group = (keyOf: (r: EarningRow) => string, describe: (key: string) => Omit<ImpactRow, "amountPaise" | "views">) => {
    const m = new Map<string, ImpactRow>();
    for (const r of inPeriod) {
      const k = keyOf(r);
      const row = m.get(k) ?? { ...describe(k), amountPaise: 0, views: 0 };
      row.amountPaise += r.amountPaise;
      row.views += r.views;
      m.set(k, row);
    }
    return Array.from(m.values()).sort((a, b) => b.amountPaise - a.amountPaise || b.views - a.views);
  };
  const byCampaign = group(
    (r) => r.campaignId,
    (k) => ({ key: k, name: campaigns.get(k)?.name ?? "Campaign" }),
  );
  const byAccount = group(
    (r) => r.accountId,
    (k) => {
      const a = accounts.get(k);
      return { key: k, name: accountLabel(a), sub: a ? PLATFORM_LABELS[a.platform] ?? a.platform : undefined };
    },
  );

  const weeklyTable = recentWeeks(8).map((w) => ({ week: w, views: byWeek.get(w)?.views ?? 0, amount: byWeek.get(w)?.amount ?? 0 }));
  const firstName = me.fullName.split(" ")[0] || me.fullName;
  const campaignName = campaign ? campaigns.get(campaign)?.name : null;

  const hasAccount = accounts.size > 0;
  const hasVerified = Array.from(accounts.values()).some((a) => a.status === "verified");
  const inCampaign = joinedCampaignIds.length > 0;

  return (
    <div className="space-y-10">
      <PageTitle eyebrow="Overview" line1={`Hey ${firstName}`} line2="here's what you've earned." />

      {rows.length === 0 ? (
        <GettingStarted hasAccount={hasAccount} hasVerified={hasVerified} inCampaign={inCampaign} />
      ) : (
        <>
          <EarningsFilters campaigns={campaignOptions} campaign={campaign} range={range} />

          {/* Hero */}
          <section aria-labelledby="hero-h" className="rounded-3xl border border-line bg-ink-2 bg-glow p-6 md:p-8">
            <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <Label>
                  <span id="hero-h">Your earnings</span> · {RANGE_LABEL[range]}
                  {campaignName ? ` · ${campaignName}` : ""}
                </Label>
                <p className="mt-3 break-words font-display text-[48px] font-bold leading-none text-cream md:text-[72px]">
                  {formatINR(earned)}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                  <span className="text-muted-dark">
                    <span className="font-semibold text-cream">{formatViews(views)}</span> views
                  </span>
                  <ChangeBadge change={change} range={range} />
                </div>
              </div>
              <TrendBars points={trend} />
            </div>
          </section>
        </>
      )}

      {/* Where your money is */}
      <section aria-labelledby="money-h">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="money-h" className="font-display text-2xl font-bold uppercase">
            Where your money is
          </h2>
          <p className="text-xs text-muted-dark">All campaigns, all time</p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Card>
            <Label>Paid out</Label>
            <p className="mt-3 font-display text-4xl font-bold">{formatINR(balance.paidPaise)}</p>
            <p className="mt-2 text-sm text-muted-dark">Already sent — in your account.</p>
          </Card>
          <Card className={cn(balance.balancePaise > 0 && "border-lime/60")}>
            <Label>Upcoming payout</Label>
            <p className={cn("mt-3 font-display text-4xl font-bold", balance.balancePaise > 0 ? "text-lime" : balance.balancePaise < 0 ? "text-[#ff8a7a]" : "")}>
              {formatINR(balance.balancePaise)}
            </p>
            <p className="mt-2 text-sm text-muted-dark">
              {balance.balancePaise < 0
                ? "Your fines currently exceed your earnings. Future earnings will cover this first."
                : "Earned − fines − paid out. Sent on the next payout run."}
            </p>
          </Card>
          <Card>
            <Label>Fines</Label>
            <p className={cn("mt-3 font-display text-4xl font-bold", balance.finesPaise > 0 && "text-[#ff8a7a]")}>
              {formatINR(balance.finesPaise)}
            </p>
            <p className="mt-2 text-sm text-muted-dark">
              {balance.finesPaise > 0 ? "Active fines, deducted from your balance. " : "No active fines — keep it up. "}
              <Link href="/portal/wallet#fines" className="inline-flex items-center gap-0.5 text-lime underline-offset-4 hover:underline">
                See details <ArrowUpRight size={13} />
              </Link>
            </p>
          </Card>
        </div>
      </section>

      {rows.length > 0 && (
        <>
          <section aria-labelledby="impact-h">
            <Card>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="impact-h" className="font-display text-2xl font-bold uppercase">
                  Where your impact is
                </h2>
                <Label>{RANGE_LABEL[range]}</Label>
              </div>
              <div className="mt-5">
                <ImpactBreakdown byCampaign={byCampaign} byAccount={byAccount} />
              </div>
            </Card>
          </section>

          <section aria-labelledby="weeks-h">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="weeks-h" className="font-display text-2xl font-bold uppercase">
                Week by week
              </h2>
              <Link href="/portal/wallet#weekly" className="inline-flex items-center gap-1 text-sm text-lime underline-offset-4 hover:underline">
                Full history <ArrowUpRight size={14} />
              </Link>
            </div>
            <p className="mt-1 text-sm text-muted-dark">
              Last 8 weeks{campaignName ? ` · ${campaignName}` : ""}. Weeks run Monday–Sunday; views are added after the weekly update.
            </p>
            <div className="mt-5">
              <TableWrap minWidth={440}>
                <thead>
                  <tr className="border-b border-line">
                    <th className={th}>Week</th>
                    <th className={cn(th, "text-right")}>Views</th>
                    <th className={cn(th, "text-right")}>Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyTable.map((w, i) => (
                    <tr key={w.week} className={tr}>
                      <td className={td}>
                        {formatWeek(w.week)}
                        {i === 0 && <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.14em] text-lime">This week</span>}
                      </td>
                      <td className={cn(td, "text-right text-muted-dark")} title={formatViews(w.views)}>
                        {w.views ? compactViews(w.views) : "—"}
                      </td>
                      <td className={cn(td, "text-right font-semibold", w.amount ? "text-cream" : "text-muted-dark")}>
                        {w.amount ? formatINR(w.amount) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function ChangeBadge({ change, range }: { change: number | "new" | null; range: string }) {
  if (range === "all") return null;
  const period = `vs previous ${range} weeks`;
  if (change === null) return <span className="text-muted-dark">No change {period}</span>;
  if (change === "new") return <span className="font-semibold text-lime">▲ New {period}</span>;
  const up = change >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-semibold", up ? "text-lime" : "text-[#ff8a7a]")}>
      <Icon size={15} aria-hidden />
      {up ? "▲" : "▼"} {Math.abs(change).toFixed(Math.abs(change) < 10 ? 1 : 0)}%
      <span className="font-normal text-muted-dark">{period}</span>
    </span>
  );
}

function GettingStarted({ hasAccount, hasVerified, inCampaign }: { hasAccount: boolean; hasVerified: boolean; inCampaign: boolean }) {
  const steps = [
    { title: "Add your account", body: "Add the Instagram / YouTube / other accounts you post clips on.", done: hasAccount, href: "/portal/accounts", cta: "Add account" },
    { title: "Get verified", body: "Put your verify code in your bio. Our team checks it and approves the account.", done: hasVerified, href: "/portal/accounts", cta: "Check status" },
    { title: "Join a campaign", body: "Get added to a campaign and start posting clips for it.", done: inCampaign, href: "/portal/campaigns", cta: "See campaigns" },
    { title: "Get paid", body: "Every week we update your views. Your earnings show up here after each weekly update.", done: false },
  ];
  const next = steps.findIndex((s) => !s.done);
  return (
    <section aria-labelledby="start-h" className="rounded-3xl border border-dashed border-line p-6 md:p-8">
      <p className="font-serif text-3xl italic text-cream" id="start-h">
        No earnings yet — here&apos;s how to start.
      </p>
      <ol className="mt-6 grid gap-4 md:grid-cols-4">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className={cn("rounded-3xl border p-5", i === next ? "border-lime bg-lime/5" : "border-line bg-ink-2", s.done && "opacity-70")}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-full font-mono text-xs",
                  s.done ? "bg-lime text-ink" : i === next ? "border border-lime text-lime" : "border border-line text-muted-dark",
                )}
                aria-hidden
              >
                {s.done ? <Check size={14} /> : i + 1}
              </span>
              <p className="font-display text-lg font-bold uppercase">{s.title}</p>
            </div>
            <p className="mt-3 text-sm text-muted-dark">{s.body}</p>
            {s.done ? (
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-lime">Done</p>
            ) : (
              s.href && (
                <Link href={s.href} className="mt-3 inline-flex items-center gap-1 text-sm text-lime underline-offset-4 hover:underline">
                  {s.cta} <ArrowUpRight size={14} />
                </Link>
              )
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
