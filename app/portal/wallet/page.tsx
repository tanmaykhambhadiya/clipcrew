import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getMe } from "@/lib/portal/session";
import { formatINR, formatViews } from "@/lib/portal/money";
import { formatDate, formatWeek } from "@/lib/portal/weeks";
import { EmptyState, Label, PageTitle, Pill, PLATFORM_LABELS, TableWrap, td, th, tr } from "@/components/portal/ui";
import { accountLabel, loadBalance, loadClipperEarnings } from "@/components/portal/earnings/data";

export const dynamic = "force-dynamic";

const STEP = 20;

/** Only real web links become clickable — anything else is shown as plain text. */
function safeHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export default async function WalletPage({ searchParams }: { searchParams: { show?: string } }) {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "clipper") redirect("/admin");

  const db = getSupabaseAdmin();
  const [balance, earnings, profileRes, payoutsRes, finesRes] = await Promise.all([
    loadBalance(me.id),
    loadClipperEarnings(me.id),
    db.from("profiles").select("upi_id").eq("id", me.id).maybeSingle(),
    db.from("payouts").select("id, amount_paise, paid_on, reference, note").eq("clipper_id", me.id).order("paid_on", { ascending: false }).order("created_at", { ascending: false }),
    db.from("fines").select("id, amount_paise, reason, reel_ref, campaign_id, created_at, waived_at").eq("clipper_id", me.id).order("created_at", { ascending: false }),
  ]);

  const upi = profileRes.data?.upi_id as string | null | undefined;
  const payouts = payoutsRes.data ?? [];
  const fines = finesRes.data ?? [];
  const loadError = payoutsRes.error || finesRes.error;

  // Campaign names for fines (a fine may point at a campaign the clipper has since left).
  const campaignNames = new Map(Array.from(earnings.campaigns.values()).map((c) => [c.id, c.name]));
  const missing = Array.from(new Set(fines.map((f) => f.campaign_id).filter((id): id is string => !!id && !campaignNames.has(id))));
  if (missing.length) {
    const { data } = await db.from("campaigns").select("id, name").in("id", missing);
    for (const c of data ?? []) campaignNames.set(c.id, c.name);
  }

  const show = Math.min(Math.max(Number.parseInt(searchParams.show ?? "", 10) || STEP, STEP), 5000);
  const weekly = earnings.rows; // already newest first
  const visible = weekly.slice(0, show);

  return (
    <div className="space-y-10">
      <PageTitle eyebrow="Wallet" line1="Your money" line2="every rupee, accounted for." />

      {loadError && <p className="text-sm text-[#ff8a7a]" role="alert">Some of your wallet couldn&apos;t load. Please refresh the page.</p>}

      {/* Balance summary */}
      <section aria-labelledby="bal-h" className="rounded-3xl border border-line bg-ink-2 bg-glow p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <Label>
              <span id="bal-h">Balance due to you</span>
            </Label>
            <p
              className={cn(
                "mt-3 break-words font-display text-[48px] font-bold leading-none md:text-[72px]",
                balance.balancePaise > 0 ? "text-lime" : balance.balancePaise < 0 ? "text-[#ff8a7a]" : "text-cream",
              )}
            >
              {formatINR(balance.balancePaise)}
            </p>
            {balance.balancePaise < 0 && (
              <p className="mt-3 max-w-md text-sm text-muted-dark">Your fines currently exceed your earnings. Future earnings will cover this first.</p>
            )}
          </div>
          <div className="rounded-2xl border border-line bg-ink/60 p-4 md:min-w-[260px]">
            <Label>Payouts go to</Label>
            {upi ? (
              <p className="mt-2 break-all font-mono text-base text-cream">{upi}</p>
            ) : (
              <p className="mt-2 text-sm text-muted-dark">
                No UPI ID yet.{" "}
                <Link href="/portal/settings" className="text-lime underline-offset-4 hover:underline">
                  Add it in settings
                </Link>{" "}
                so we can pay you.
              </p>
            )}
          </div>
        </div>
        <dl className="mt-8 grid grid-cols-1 gap-4 border-t border-line pt-6 sm:grid-cols-3">
          <div>
            <dt><Label>Total earned</Label></dt>
            <dd className="mt-1 font-display text-2xl font-bold">{formatINR(balance.earnedPaise)}</dd>
          </div>
          <div>
            <dt><Label>− Active fines</Label></dt>
            <dd className={cn("mt-1 font-display text-2xl font-bold", balance.finesPaise > 0 && "text-[#ff8a7a]")}>{formatINR(balance.finesPaise)}</dd>
          </div>
          <div>
            <dt><Label>− Paid out</Label></dt>
            <dd className="mt-1 font-display text-2xl font-bold">{formatINR(balance.paidPaise)}</dd>
          </div>
        </dl>
      </section>

      {/* Payouts */}
      <section aria-labelledby="payouts-h" id="payouts" className="scroll-mt-40">
        <h2 id="payouts-h" className="font-display text-2xl font-bold uppercase">Payouts</h2>
        <div className="mt-5">
          {payouts.length === 0 ? (
            <EmptyState title="No payouts yet">When we send you money it shows up here with the UPI reference.</EmptyState>
          ) : (
            <TableWrap minWidth={560}>
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>Paid on</th>
                  <th className={cn(th, "text-right")}>Amount</th>
                  <th className={th}>Reference</th>
                  <th className={th}>Note</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id} className={tr}>
                    <td className={cn(td, "whitespace-nowrap")}>{formatDate(p.paid_on)}</td>
                    <td className={cn(td, "text-right font-semibold text-lime")}>{formatINR(p.amount_paise)}</td>
                    <td className={cn(td, "break-all font-mono text-xs text-muted-dark")}>{p.reference || "—"}</td>
                    <td className={cn(td, "text-muted-dark")}>{p.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </div>
      </section>

      {/* Fines */}
      <section aria-labelledby="fines-h" id="fines" className="scroll-mt-40">
        <h2 id="fines-h" className="font-display text-2xl font-bold uppercase">Fines</h2>
        <p className="mt-1 text-sm text-muted-dark">Active fines are deducted from your balance. Waived fines don&apos;t count.</p>
        <div className="mt-5">
          {fines.length === 0 ? (
            <EmptyState title="No fines">Clean record — nice work.</EmptyState>
          ) : (
            <TableWrap minWidth={680}>
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>Date</th>
                  <th className={cn(th, "text-right")}>Amount</th>
                  <th className={th}>Reason</th>
                  <th className={th}>Campaign</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {fines.map((f) => {
                  const link = safeHttpUrl(f.reel_ref);
                  return (
                    <tr key={f.id} className={tr}>
                      <td className={cn(td, "whitespace-nowrap")}>{formatDate(f.created_at)}</td>
                      <td className={cn(td, "text-right font-semibold", f.waived_at ? "text-muted-dark line-through" : "text-[#ff8a7a]")}>
                        {formatINR(f.amount_paise)}
                      </td>
                      <td className={td}>
                        <p>{f.reason}</p>
                        {link ? (
                          <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 text-xs text-lime underline-offset-4 hover:underline">
                            View reel <ExternalLink size={12} />
                          </a>
                        ) : (
                          f.reel_ref && <p className="mt-1 break-all text-xs text-muted-dark">{f.reel_ref}</p>
                        )}
                      </td>
                      <td className={cn(td, "text-muted-dark")}>{f.campaign_id ? campaignNames.get(f.campaign_id) ?? "—" : "—"}</td>
                      <td className={td}>{f.waived_at ? <Pill tone="grey">Waived</Pill> : <Pill tone="red">Active</Pill>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          )}
        </div>
      </section>

      {/* Weekly earnings */}
      <section aria-labelledby="weekly-h" id="weekly" className="scroll-mt-40">
        <h2 id="weekly-h" className="font-display text-2xl font-bold uppercase">Weekly earnings</h2>
        <p className="mt-1 text-sm text-muted-dark">One row per account, campaign and week (Monday–Sunday), newest first.</p>
        <div className="mt-5">
          {weekly.length === 0 ? (
            <EmptyState title="No weekly earnings yet">
              Once your account is verified and you&apos;re in a campaign, your views are added every week.{" "}
              <Link href="/portal/accounts" className="text-lime underline-offset-4 hover:underline">Your accounts</Link>
            </EmptyState>
          ) : (
            <>
              <TableWrap minWidth={640}>
                <thead>
                  <tr className="border-b border-line">
                    <th className={th}>Week</th>
                    <th className={th}>Campaign</th>
                    <th className={th}>Account</th>
                    <th className={cn(th, "text-right")}>Views</th>
                    <th className={cn(th, "text-right")}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((w) => {
                    const a = earnings.accounts.get(w.accountId);
                    return (
                      <tr key={`${w.campaignId}-${w.accountId}-${w.weekStart}`} className={tr}>
                        <td className={cn(td, "whitespace-nowrap")}>{formatWeek(w.weekStart)}</td>
                        <td className={td}>{earnings.campaigns.get(w.campaignId)?.name ?? "—"}</td>
                        <td className={td}>
                          {accountLabel(a)}
                          {a && <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-dark">{PLATFORM_LABELS[a.platform] ?? a.platform}</span>}
                        </td>
                        <td className={cn(td, "text-right text-muted-dark")}>{formatViews(w.views)}</td>
                        <td className={cn(td, "text-right font-semibold")}>{formatINR(w.amountPaise)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrap>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-dark">
                <span>
                  Showing {visible.length} of {weekly.length}
                </span>
                {visible.length < weekly.length && (
                  <Link
                    href={`/portal/wallet?show=${show + STEP}#weekly`}
                    scroll={false}
                    className="inline-flex items-center gap-1 rounded-full border border-line px-4 py-2 text-cream transition hover:border-lime hover:text-lime"
                  >
                    Show more <ArrowUpRight size={14} className="rotate-90" />
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
