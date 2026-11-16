import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatINR, formatViews } from "@/lib/portal/money";
import { can, getMe } from "@/lib/portal/session";
import { pageApi } from "@/lib/server-api";
import { formatDate, formatWeek } from "@/lib/portal/weeks";
import { Card, EmptyState, Label, PLATFORM_LABELS, PageTitle, Pill, TableWrap, td, th, tr } from "@/components/portal/ui";
import { ACTION_LABELS } from "../../activity/labels";
import { ClipperActions } from "./ClipperActions";

export const dynamic = "force-dynamic";

type Detail = {
  profile: { id: string; login_id: string; full_name: string; status: "active" | "terminated"; phone: string | null; upi_id: string | null; created_at: string; terminated_at: string | null; termination_reason: string | null };
  accounts: { id: string; platform: string; username: string; status: "pending" | "verified" | "rejected"; verify_code: string; created_at: string; campaigns: string[] }[];
  campaigns: { id: string; name: string; status: string; joined_at: string; views: number; earned_paise: number }[];
  submissions: { id: string; url: string; status: "pending" | "approved" | "rejected"; created_at: string; reject_reason: string | null; campaign_name: string; platform: string; username: string }[];
  weekly: { week_start: string; views: number; amount_paise: number }[];
  fines: { id: string; amount_paise: number; reason: string; reel_ref: string | null; created_at: string; waived_at: string | null; campaign_name: string | null }[];
  payouts: { id: string; amount_paise: number; paid_on: string; reference: string | null; note: string | null }[];
  notices: { id: string; kind: string; title: string; created_at: string; read_at: string | null }[];
  activity: { id: string; action: string; created_at: string; actor_name: string | null }[];
  balance: { earned_paise: number; fines_paise: number; paid_paise: number };
  can: { terminate: boolean; editProfile: boolean; payouts: boolean; notices: boolean; verifyAccounts: boolean; reviewSubmissions: boolean };
};

const TONE = { pending: "amber", verified: "lime", approved: "lime", rejected: "red" } as const;
const safeUrl = (v: string | null) => (v && /^https?:\/\//i.test(v) ? v : null);

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-3xl border border-line bg-ink-2 p-5">
      <Label>{label}</Label>
      <p className={`mt-2 font-display text-3xl font-bold leading-none ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

export default async function ClipperPage({ params }: { params: { id: string } }) {
  const me = await getMe();
  if (!me || !can(me, "users.create")) redirect("/admin");

  const d = await pageApi<Detail>(`/api/pages/admin/clippers/${params.id}`, { forbiddenTo: "/admin/clippers" });
  const p = d.profile;
  const balance = Number(d.balance.earned_paise) - Number(d.balance.fines_paise) - Number(d.balance.paid_paise);

  return (
    <div className="space-y-10">
      <Link href="/admin/clippers" className="inline-flex items-center gap-1.5 text-sm text-muted-dark hover:text-lime">
        <ArrowLeft size={15} aria-hidden /> All clippers
      </Link>
      <PageTitle eyebrow={`Clipper · ${p.status}`} line1={p.full_name} line2={p.login_id} />
      {p.status === "terminated" && (
        <p className="rounded-2xl border border-[#ff8a7a]/40 bg-[#ff8a7a]/10 p-4 text-sm text-[#ff8a7a]">
          Terminated {formatDate(p.terminated_at)}{p.termination_reason ? ` — ${p.termination_reason}` : ""}.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Earned" value={formatINR(d.balance.earned_paise)} tone="text-lime" />
        <Stat label="Fines" value={formatINR(d.balance.fines_paise)} />
        <Stat label="Paid out" value={formatINR(d.balance.paid_paise)} />
        <Stat label="Balance due" value={formatINR(balance)} tone={balance > 0 ? "text-lime" : balance < 0 ? "text-[#ff8a7a]" : ""} />
      </div>

      <p className="text-sm text-muted-dark">
        {p.phone ? <>Phone <span className="font-mono text-cream">{p.phone}</span> · </> : "No phone · "}
        {p.upi_id ? <>UPI <span className="font-mono text-cream">{p.upi_id}</span></> : "No UPI ID"} · Joined {formatDate(p.created_at)}
        {d.can.payouts && <> · <Link href="/admin/payouts" className="text-lime underline-offset-4 hover:underline">Record a payout</Link></>}
      </p>

      <ClipperActions
        id={p.id}
        loginId={p.login_id}
        fullName={p.full_name}
        phone={p.phone ?? ""}
        upiId={p.upi_id ?? ""}
        status={p.status}
        can={{ terminate: d.can.terminate, editProfile: d.can.editProfile, notices: d.can.notices }}
      />

      <section aria-labelledby="acc-h" className="space-y-3">
        <h2 id="acc-h" className="font-display text-2xl font-bold uppercase">Accounts</h2>
        {d.accounts.length === 0 ? (
          <EmptyState title="No accounts added yet" />
        ) : (
          <TableWrap minWidth={720}>
            <thead>
              <tr className={tr}><th className={th}>Account</th><th className={th}>Status</th><th className={th}>Code</th><th className={th}>Counts in</th></tr>
            </thead>
            <tbody>
              {d.accounts.map((a) => (
                <tr key={a.id} className={tr}>
                  <td className={td}><p className="text-xs text-muted-dark">{PLATFORM_LABELS[a.platform] ?? a.platform}</p><p className="font-mono">@{a.username}</p></td>
                  <td className={td}>
                    <Pill tone={TONE[a.status]}>{a.status}</Pill>
                    {a.status === "pending" && d.can.verifyAccounts && <p className="mt-1"><Link href={`/admin/accounts?q=${encodeURIComponent(a.username)}`} className="text-xs text-lime underline-offset-4 hover:underline">Send code / verify</Link></p>}
                  </td>
                  <td className={`${td} font-mono text-xs`}>{a.verify_code || <span className="text-[#f5c451]">not sent</span>}</td>
                  <td className={`${td} text-xs text-muted-dark`}>{a.campaigns.length ? a.campaigns.join(", ") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </section>

      <section aria-labelledby="camp-h" className="space-y-3">
        <h2 id="camp-h" className="font-display text-2xl font-bold uppercase">Campaigns</h2>
        {d.campaigns.length === 0 ? (
          <EmptyState title="Not in any campaign" />
        ) : (
          <TableWrap minWidth={640}>
            <thead><tr className={tr}><th className={th}>Campaign</th><th className={th}>Joined</th><th className={`${th} text-right`}>Views</th><th className={`${th} text-right`}>Earned</th></tr></thead>
            <tbody>
              {d.campaigns.map((c) => (
                <tr key={c.id} className={tr}>
                  <td className={td}><Link href={`/admin/campaigns/${c.id}`} className="font-medium underline-offset-4 hover:text-lime hover:underline">{c.name}</Link> <Pill tone="grey">{c.status}</Pill></td>
                  <td className={`${td} text-xs text-muted-dark`}>{formatDate(c.joined_at)}</td>
                  <td className={`${td} text-right font-mono`}>{formatViews(c.views)}</td>
                  <td className={`${td} text-right font-mono text-lime`}>{formatINR(c.earned_paise)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </section>

      <section aria-labelledby="sub-h" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="sub-h" className="font-display text-2xl font-bold uppercase">Latest submissions</h2>
          {d.can.reviewSubmissions && <Link href={`/admin/submissions?status=all&q=${encodeURIComponent(p.login_id)}`} className="text-sm text-lime underline-offset-4 hover:underline">Review all →</Link>}
        </div>
        {d.submissions.length === 0 ? (
          <EmptyState title="No submissions yet" />
        ) : (
          <TableWrap minWidth={680}>
            <thead><tr className={tr}><th className={th}>Reel</th><th className={th}>Campaign</th><th className={th}>Status</th><th className={th}>Submitted</th></tr></thead>
            <tbody>
              {d.submissions.map((s) => {
                const link = safeUrl(s.url);
                return (
                  <tr key={s.id} className={tr}>
                    <td className={td}>
                      {link ? <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-[260px] items-center gap-1 text-lime underline-offset-4 hover:underline"><span className="truncate">{s.url.replace(/^https?:\/\/(www\.)?/, "")}</span><ExternalLink size={12} aria-hidden /></a> : s.url}
                      <p className="text-xs text-muted-dark">@{s.username}</p>
                    </td>
                    <td className={td}>{s.campaign_name}</td>
                    <td className={td}><Pill tone={TONE[s.status]}>{s.status}</Pill>{s.reject_reason && <p className="mt-1 max-w-[220px] text-xs text-[#ff8a7a]">{s.reject_reason}</p>}</td>
                    <td className={`${td} text-xs text-muted-dark`}>{formatDate(s.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="wk-h" className="space-y-3">
          <h2 id="wk-h" className="font-display text-2xl font-bold uppercase">Weekly earnings</h2>
          {d.weekly.length === 0 ? <EmptyState title="No weeks yet" /> : (
            <TableWrap minWidth={380}>
              <thead><tr className={tr}><th className={th}>Week</th><th className={`${th} text-right`}>Views</th><th className={`${th} text-right`}>Earned</th></tr></thead>
              <tbody>
                {d.weekly.map((w) => (
                  <tr key={w.week_start} className={tr}>
                    <td className={`${td} whitespace-nowrap text-xs`}>{formatWeek(w.week_start)}</td>
                    <td className={`${td} text-right font-mono`}>{formatViews(w.views)}</td>
                    <td className={`${td} text-right font-mono text-lime`}>{formatINR(w.amount_paise)}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </section>

        <section aria-labelledby="pay-h" className="space-y-3">
          <h2 id="pay-h" className="font-display text-2xl font-bold uppercase">Payouts &amp; fines</h2>
          {d.payouts.length === 0 && d.fines.length === 0 ? <EmptyState title="Nothing yet" /> : (
            <TableWrap minWidth={380}>
              <thead><tr className={tr}><th className={th}>When</th><th className={th}>What</th><th className={`${th} text-right`}>Amount</th></tr></thead>
              <tbody>
                {d.payouts.map((y) => (
                  <tr key={y.id} className={tr}>
                    <td className={`${td} whitespace-nowrap text-xs`}>{formatDate(y.paid_on)}</td>
                    <td className={td}>Payout{y.reference ? <span className="text-xs text-muted-dark"> · {y.reference}</span> : null}</td>
                    <td className={`${td} text-right font-mono`}>{formatINR(y.amount_paise)}</td>
                  </tr>
                ))}
                {d.fines.map((f) => (
                  <tr key={f.id} className={tr}>
                    <td className={`${td} whitespace-nowrap text-xs`}>{formatDate(f.created_at)}</td>
                    <td className={td}>Fine{f.waived_at ? <Pill tone="grey">waived</Pill> : null}<p className="max-w-[240px] text-xs text-muted-dark">{f.reason}</p></td>
                    <td className={`${td} text-right font-mono ${f.waived_at ? "line-through opacity-60" : "text-[#ff8a7a]"}`}>{formatINR(f.amount_paise)}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <Label>Recent notices to them</Label>
          {d.notices.length === 0 ? <p className="mt-3 text-sm text-muted-dark">Nothing sent yet.</p> : (
            <ul className="mt-3 space-y-2 text-sm">
              {d.notices.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate">{n.title}</span>
                  <span className="shrink-0 text-xs text-muted-dark">{formatDate(n.created_at)} · {n.read_at ? "read" : "unread"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {can(me, "audit.view") && (
          <Card>
            <Label>Recent activity</Label>
            {d.activity.length === 0 ? <p className="mt-3 text-sm text-muted-dark">No activity yet.</p> : (
              <ul className="mt-3 space-y-2 text-sm">
                {d.activity.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate">{ACTION_LABELS[a.action] ?? a.action}{a.actor_name ? <span className="text-muted-dark"> · {a.actor_name}</span> : null}</span>
                    <span className="shrink-0 text-xs text-muted-dark">{formatDate(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
