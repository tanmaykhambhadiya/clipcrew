"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AtSign,
  Ban,
  Banknote,
  Bell,
  ChartColumn,
  Clapperboard,
  History,
  LayoutDashboard,
  Link2,
  LogOut,
  Megaphone,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { apiUrl } from "@/lib/apiUrl";
import { SIDEBAR_COOKIE } from "@/lib/portal/sidebar";

// Icons are picked by name: the layouts are server components and can't pass icon components down.
const ICONS = {
  overview: LayoutDashboard,
  campaigns: Clapperboard,
  views: ChartColumn,
  submissions: Link2,
  accounts: AtSign,
  clippers: Users,
  notices: Megaphone,
  rejections: Ban,
  payouts: Banknote,
  users: UserCog,
  invites: UserPlus,
  activity: History,
  settings: Settings,
  wallet: Wallet,
  inbox: Bell,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;
export type ShellItem = { href: string; label: string; icon: IconName; badge?: number };


type Props = {
  items: ShellItem[];
  root: string;
  brandTag?: string;
  userName: string;
  userRole?: string;
  /** Read from the cc_sidebar cookie on the server, so the first paint is already right. */
  initialCollapsed: boolean;
  /** Extra buttons for the phone top bar (e.g. the inbox bell). */
  mobileExtra?: React.ReactNode;
  children: React.ReactNode;
};

const fmtBadge = (n: number) => (n > 99 ? "99+" : String(n));

/** Admin/portal frame: a left sidebar that collapses to icons (remembered), and a slide-out menu on phones. */
export function AppShell({ items, root, brandTag, userName, userRole, initialCollapsed, mobileExtra, children }: Props) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Tooltip for the icons-only sidebar. Drawn with position:fixed so the scrolling menu can't clip it.
  const [tip, setTip] = useState<{ label: string; y: number } | null>(null);
  const showTip = (label: string) => (e: React.SyntheticEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ label, y: r.top + r.height / 2 });
  };

  const isActive = (href: string) => (href === root ? path === root : path === href || path.startsWith(`${href}/`));

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  }

  // Close the phone menu after navigating, and on Escape.
  useEffect(() => {
    setMobileOpen(false);
    setTip(null);
  }, [path]);
  useEffect(() => setTip(null), [collapsed]);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  async function logout() {
    await fetch(apiUrl("/api/auth/logout"), { method: "POST", credentials: "include" });
    window.location.assign("/login");
  }

  const brand = (small: boolean) => (
    <Link href={root} className="flex min-w-0 items-center gap-2 font-display text-xl font-bold uppercase tracking-wide" aria-label="ClipCrew home">
      {small ? (
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-lime text-base text-ink">C</span>
      ) : (
        <>
          <span className="truncate">ClipCrew</span>
          {brandTag && <span className="font-mono text-[10px] tracking-[0.2em] text-lime">{brandTag}</span>}
        </>
      )}
    </Link>
  );

  /** The list of links; `compact` = icons only (collapsed desktop sidebar). */
  const nav = (compact: boolean) => (
    <nav aria-label="Sections" className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
      <ul className="space-y-1">
        {items.map((n) => {
          const Icon = ICONS[n.icon];
          const active = isActive(n.href);
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                onMouseEnter={compact ? showTip(n.label) : undefined}
                onMouseLeave={compact ? () => setTip(null) : undefined}
                onFocus={compact ? showTip(n.label) : undefined}
                onBlur={compact ? () => setTip(null) : undefined}
                aria-current={active ? "page" : undefined}
                aria-label={compact ? `${n.label}${n.badge ? `, ${n.badge}` : ""}` : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl text-sm transition",
                  compact ? "h-11 w-11 justify-center" : "px-3 py-2.5",
                  active ? "bg-lime font-semibold text-ink" : "text-muted-dark hover:bg-ink-2 hover:text-lime",
                )}
              >
                <Icon size={19} aria-hidden className="shrink-0" />
                {!compact && <span className="min-w-0 flex-1 truncate">{n.label}</span>}
                {!!n.badge &&
                  (compact ? (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute -right-1 -top-1 min-w-[18px] rounded-full px-1 text-center font-mono text-[10px] leading-[18px]",
                        active ? "bg-ink text-lime ring-2 ring-lime" : "bg-lime text-ink ring-2 ring-ink",
                      )}
                    >
                      {fmtBadge(n.badge)}
                    </span>
                  ) : (
                    <span className={cn("rounded-full px-1.5 font-mono text-[10px]", active ? "bg-ink text-lime" : "bg-lime text-ink")}>{fmtBadge(n.badge)}</span>
                  ))}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const footer = (compact: boolean) => (
    <div className={cn("border-t border-line p-3", compact && "flex flex-col items-center gap-2")}>
      {!compact && (
        <p className="truncate px-2 pb-2 text-sm text-cream">
          {userName}
          {userRole && <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-lime">{userRole}</span>}
        </p>
      )}
      <button
        type="button"
        onClick={logout}
        title={compact ? "Sign out" : undefined}
        aria-label="Sign out"
        className={cn(
          "inline-flex items-center gap-3 rounded-xl text-sm text-muted-dark transition hover:bg-ink-2 hover:text-lime",
          compact ? "h-11 w-11 justify-center" : "w-full px-3 py-2.5",
        )}
      >
        <LogOut size={18} aria-hidden /> {!compact && "Sign out"}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-ink text-cream md:flex">
      {/* ── desktop sidebar ── */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-ink transition-[width] duration-200 md:flex",
          collapsed ? "w-[76px]" : "w-[248px]",
        )}
      >
        <div className={cn("flex items-center gap-2 py-5", collapsed ? "flex-col px-3" : "justify-between pl-5 pr-3")}>
          {brand(collapsed)}
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Show menu labels" : "Hide menu labels"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand" : "Collapse"}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line text-muted-dark transition hover:border-lime hover:text-lime"
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>
        {nav(collapsed)}
        {footer(collapsed)}
        {collapsed && tip && (
          <span
            aria-hidden
            style={{ top: tip.y }}
            className="pointer-events-none fixed left-[84px] z-50 -translate-y-1/2 whitespace-nowrap rounded-lg border border-line bg-ink-2 px-2.5 py-1.5 text-xs text-cream shadow-lg"
          >
            {tip.label}
          </span>
        )}
      </aside>

      {/* ── phone top bar + slide-out menu ── */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-line bg-ink/90 px-4 py-3 backdrop-blur-md md:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line text-muted-dark transition hover:border-lime hover:text-lime"
          >
            <Menu size={19} />
            {items.some((n) => n.badge) && <span aria-hidden className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-lime" />}
          </button>
          {brand(false)}
        </div>
        {mobileExtra}
      </header>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[min(280px,85vw)] flex-col border-r border-line bg-ink shadow-2xl">
            <div className="flex items-center justify-between py-4 pl-5 pr-3">
              {brand(false)}
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="grid h-9 w-9 place-items-center rounded-xl border border-line text-muted-dark hover:border-lime hover:text-lime"
              >
                <X size={17} />
              </button>
            </div>
            {nav(false)}
            {footer(false)}
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-[1280px] px-4 py-8 sm:px-5 md:px-8 md:py-10">{children}</main>
      </div>
    </div>
  );
}
