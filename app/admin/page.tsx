import Link from "next/link";
import {
  ArrowRight,
  Ban,
  ChartColumn,
  Clapperboard,
  Download,
  Hourglass,
  IndianRupee,
  Megaphone,
  Plus,
  Share2,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/supabase";
import { staffCampaignIds } from "@/lib/portal/guard";
import { can, getMe, type Me } from "@/lib/portal/session";
import { compactViews, formatINR, formatViews } from "@/lib/portal/money";
import { addDays, currentWeekStart, formatWeek } from "@/lib/portal/weeks";
import { Card, EmptyState, Label, Pill } from "@/components/portal/ui";
import { balanceOf, clipperIdsForCampaigns, fetchAll, fetchBalances, fetchByIds } from "@/app/api/admin/export/data";
import { loadActivity, type ActivityEntry } from "@/app/api/admin/activity/load";
import { actionLabel, actionTone } from "./activity/labels";
import { ExportsCard, SharePortal } from "./settings/ShareCards";

export const dynamic = "force-dynamic";

type Tile = { label: string; value: string; sub?: string; href?: string; icon: LucideIcon; accent?: boolean };

/** Runs a stat loader; a failure shows "—" instead of breaking the whole dashboard. */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error("[admin overview]", e);
    return fallback;
  }
}

async function loadStats(me: Me) {
  const db = getSupabaseAdmin();
  const scope = await staffCampaignIds(me); // null = all campaigns
  const none = scope !== null && scope.length === 0;
  const lastWeek = addDays(currentWeekStart(), -7);

  // Independent loads run together — each database round trip is slow from the app server.
  const [campaigns, clipperIds] = await Promise.all([
    safe(async () => {
      if (none) return [] as Array<{ id: string; name: string; status: string }>;
      let q = db.from("campaigns").select("id, name, status").order("created_at", { ascending: false });
      if (scope) q = q.in("id", scope);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string; status: string }>;
    }, null),
    safe(() => clipperIdsForCampaigns(scope), [] as string[] | null),
  ]);

  const [activeClippers, pending, week, unpaid, fines] = await Promise.all([
    safe(async () => {
      if (clipperIds === null) {
        const { count, error } = await db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "clipper").eq("status", "active");
        if (error) throw error;
        return count ?? 0;
      }
      const people = await fetchByIds<{ status: string; role: string }>("profiles", "id, status, role", clipperIds);
      return people.filter((p) => p.role === "clipper" && p.status === "active").length;
    }, null as number | null),

    can(me, "accounts.verify")
      ? safe(async () => {
          const { count, error } = await db.from("social_accounts").select("id", { count: "exact", head: true }).eq("status", "pending");
          if (error) throw error;
          return count ?? 0;
        }, null as number | null)
      : Promise.resolve(undefined),

    safe(async () => {
      if (none) return { views: 0, amount: 0, rows: 0 };
      const rows = await fetchAll<{ views: number; amount_paise: number }>((from, to) => {
        let q = db.from("weekly_views").select("views, amount_paise").eq("week_start", lastWeek);
        if (scope) q = q.in("campaign_id", scope);
        return q.range(from, to);
      });
      return {
        views: rows.reduce((s, r) => s + Number(r.views), 0),
        amount: rows.reduce((s, r) => s + Number(r.amount_paise), 0),
        rows: rows.length,
      };
    }, null as { views: number; amount: number; rows: number } | null),

    can(me, "payouts.manage")
      ? safe(async () => {
          const balances = await fetchBalances(clipperIds);
          const owed = balances.map(balanceOf).filter((b) => b > 0);
          return { total: owed.reduce((s, b) => s + b, 0), clippers: owed.length };
        }, null as { total: number; clippers: number } | null)
      : Promise.resolve(undefined),

    can(me, "fines.create") || can(me, "payouts.manage") || can(me, "rejections.send")
      ? safe(async () => {
          if (none) return { total: 0, count: 0 };
          const rows = await fetchAll<{ amount_paise: number }>((from, to) => {
            let q = db.from("fines").select("amount_paise").is("waived_at", null);
            if (scope) q = q.in("campaign_id", scope);
            return q.range(from, to);
          });
          return { total: rows.reduce((s, r) => s + Number(r.amount_paise), 0), count: rows.length };
        }, null as { total: number; count: number } | null)
      : Promise.resolve(undefined),
  ]);

  return { campaigns, activeClippers, pending, week, unpaid, fines, lastWeek, isScoped: scope !== null };
}

function StatTile({ t }: { t: Tile }) {
  const Icon = t.icon;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <Label>{t.label}</Label>
        <Icon size={18} className={t.accent ? "text-lime" : "text-muted-dark"} aria-hidden />
      </div>
      <p className={`mt-4 font-display text-[34px] font-bold leading-none md:text-[40px] ${t.accent ? "text-lime" : "text-cream"}`}>{t.value}</p>
      {t.sub && <p className="mt-2 text-xs text-muted-dark">{t.sub}</p>}
    </>
  );
  const cls = "block h-full rounded-3xl border border-line bg-ink-2 p-5 md:p-6";
  return t.href ? (
    <Link
      href={t.href}
      className={`${cls} transition hover:-translate-y-0.5 hover:border-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime`}
    >
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

export default async function AdminHome() {
  const me = (await getMe())!; // the layout already redirects signed-out users and clippers
  // Start the activity feed alongside the stats instead of after them.
  const recentPromise = can(me, "audit.view")
    ? safe(async () => (await loadActivity({ limit: 10 })).entries, null as ActivityEntry[] | null)
    : Promise.resolve(null as ActivityEntry[] | null);
  const s = await loadStats(me);
  const dash = "—";

  const activeCampaigns = s.campaigns?.filter((c) => c.status === "active").length;
  const tiles: Tile[] = [
    {
      label: "Active campaigns",
      value: activeCampaigns === undefined ? dash : String(activeCampaigns),
      sub: s.campaigns ? `${s.campaigns.length} total${s.isScoped ? " assigned to you" : ""}` : undefined,
      href: "/admin/campaigns",
      icon: Megaphone,
      accent: true,
    },
    {
      label: "Active clippers",
      value: s.activeClippers === null ? dash : String(s.activeClippers),
      sub: s.isScoped ? "In your campaigns" : "Across ClipCrew",
      href: can(me, "users.create") ? "/admin/users" : undefined,
      icon: Users,
    },
  ];
  if (s.pending !== undefined)
    tiles.push({
      label: "Pending verifications",
      value: s.pending === null ? dash : String(s.pending),
      sub: s.pending ? "Accounts waiting for a check" : "All caught up",
      href: "/admin/accounts",
      icon: ShieldCheck,
      accent: !!s.pending,
    });
  tiles.push({
    label: "Last week's views",
    value: s.week === null ? dash : compactViews(s.week.views),
    sub: s.week === null ? undefined : `${formatWeek(s.lastWeek)} · ${formatINR(s.week.amount, { decimals: false })} earned`,
    href: can(me, "views.enter") ? "/admin/views" : undefined,
    icon: ChartColumn,
  });
  if (s.unpaid !== undefined)
    tiles.push({
      label: "Unpaid balance",
      value: s.unpaid === null ? dash : formatINR(s.unpaid.total, { decimals: false }),
      sub: s.unpaid ? `Owed to ${s.unpaid.clippers} clipper${s.unpaid.clippers === 1 ? "" : "s"}` : undefined,
      href: "/admin/payouts",
      icon: Wallet,
    });
  if (s.fines !== undefined)
    tiles.push({
      label: "Active fines",
      value: s.fines === null ? dash : formatINR(s.fines.total, { decimals: false }),
      sub: s.fines ? `${s.fines.count} fine${s.fines.count === 1 ? "" : "s"} not waived` : undefined,
      href: can(me, "rejections.send") || can(me, "fines.create") ? "/admin/rejections" : undefined,
      icon: Ban,
    });

  const actions = [
    { href: "/admin/campaigns/new", label: "New campaign", icon: Plus, show: can(me, "campaigns.manage") },
    { href: "/admin/views", label: "Enter weekly views", icon: ChartColumn, show: can(me, "views.enter") },
    { href: "/admin/accounts", label: "Verify accounts", icon: ShieldCheck, show: can(me, "accounts.verify") },
    { href: "/admin/rejections", label: "Send rejection", icon: Clapperboard, show: can(me, "rejections.send") },
    { href: "/admin/payouts", label: "Record payout", icon: IndianRupee, show: can(me, "payouts.manage") },
    { href: "/admin/users", label: "Add user", icon: UserPlus, show: can(me, "users.create") },
  ].filter((a) => a.show);

  const recent = await recentPromise;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-lime">{"//"} Overview</p>
          <h1 className="mt-3 text-[34px] leading-[1.02] md:text-[48px]">
            <span className="block font-display font-bold uppercase">Welcome back,</span>
            <span className="block font-serif italic text-lime">{me.fullName.split(" ")[0]}.</span>
          </h1>
        </div>
        <Pill tone={me.role === "super_admin" ? "lime" : "cyan"}>{me.role === "super_admin" ? "Super admin · all campaigns" : "Staff · your campaigns"}</Pill>
      </div>

      <section aria-label="Key numbers" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((t) => (
          <StatTile key={t.label} t={t} />
        ))}
      </section>

      {s.week && s.week.rows > 0 && (
        <p className="-mt-4 text-xs text-muted-dark">
          Last completed week: {formatViews(s.week.views)} views across {s.week.rows} account entr{s.week.rows === 1 ? "y" : "ies"}.
        </p>
      )}

      {actions.length > 0 && (
        <section aria-labelledby="qa-title">
          <h2 id="qa-title" className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark">
            Quick actions
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {actions.map((a, i) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.href + a.label}
                  href={a.href}
                  className={
                    i === 0
                      ? "inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:shadow-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
                      : "inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm text-cream transition hover:border-lime hover:text-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
                  }
                >
                  <Icon size={15} aria-hidden /> {a.label}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {can(me, "audit.view") ? (
          <Card className="min-w-0">
            <div className="flex items-center justify-between gap-3">
              <Label>Recent activity</Label>
              <Link href="/admin/activity" className="inline-flex items-center gap-1 text-xs text-lime hover:underline">
                See all <ArrowRight size={13} />
              </Link>
            </div>
            {recent === null ? (
              <p className="mt-4 text-sm text-[#ff8a7a]">Couldn&apos;t load recent activity.</p>
            ) : recent.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="Quiet so far.">Changes made in the portal will appear here.</EmptyState>
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-line/60">
                {recent.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Pill tone={actionTone(e.action)}>{actionLabel(e.action)}</Pill>
                      <span className="truncate text-sm text-cream">{e.actor?.name ?? "System"}</span>
                    </div>
                    <time className="font-mono text-[11px] text-muted-dark" dateTime={e.created_at}>
                      {when(e.created_at)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : (
          <Card className="min-w-0">
            <Label>Your campaigns</Label>
            {!s.campaigns || s.campaigns.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="No campaigns yet.">
                  {s.isScoped ? "Once the super admin assigns you to a campaign it will show up here." : "Create your first campaign to get started."}
                </EmptyState>
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-line/60">
                {s.campaigns.slice(0, 8).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                    <Link href={`/admin/campaigns/${c.id}`} className="truncate text-sm text-cream hover:text-lime">
                      {c.name}
                    </Link>
                    <Pill tone={c.status === "active" ? "lime" : c.status === "paused" ? "amber" : "grey"}>{c.status}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <div className="min-w-0 space-y-6">
          <Card>
            <div className="flex items-center gap-2">
              <Share2 size={16} className="text-lime" aria-hidden />
              <Label>Share the portal</Label>
            </div>
            <p className="mb-4 mt-2 text-sm text-muted-dark">Send clippers the sign-in link. Each person signs in with the login ID you create for them.</p>
            <SharePortal />
          </Card>

          {can(me, "export.data") && (
            <Card>
              <div className="flex items-center gap-2">
                <Download size={16} className="text-lime" aria-hidden />
                <Label>Exports</Label>
              </div>
              <div className="mt-4">
                <ExportsCard campaigns={(s.campaigns ?? []).map((c) => ({ id: c.id, name: c.name }))} />
              </div>
            </Card>
          )}

          {s.pending !== undefined && s.pending !== null && s.pending > 0 && (
            <Link
              href="/admin/accounts"
              className="flex items-center justify-between gap-3 rounded-3xl border border-lime/60 bg-lime/10 p-5 text-sm transition hover:border-lime"
            >
              <span className="flex items-center gap-2">
                <Hourglass size={16} className="text-lime" aria-hidden />
                {s.pending} account{s.pending === 1 ? "" : "s"} waiting for verification
              </span>
              <ArrowRight size={16} className="text-lime" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
