"use client";

import { BadgeCheck, Ban, Check, CheckCheck, ExternalLink, IndianRupee, Info, LoaderCircle, Megaphone, ShieldX, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { api } from "@/lib/portal/client";
import { formatDate } from "@/lib/portal/weeks";
import { EmptyState, ErrorNote, smallBtn } from "@/components/portal/ui";

type Kind = "reel_rejected" | "fine" | "account_verified" | "account_rejected" | "payout" | "info";
type Item = {
  id: string;
  kind: Kind;
  title: string;
  body: string | null;
  reelRef: string | null;
  campaignName: string | null;
  createdAt: string;
  readAt: string | null;
};

const KIND: Record<Kind, { icon: typeof Info; tone: string; label: string }> = {
  reel_rejected: { icon: Ban, tone: "bg-[#ff8a7a]/15 text-[#ff8a7a]", label: "Reel rejected" },
  fine: { icon: IndianRupee, tone: "bg-[#f5c451]/15 text-[#f5c451]", label: "Fine" },
  account_verified: { icon: BadgeCheck, tone: "bg-lime/15 text-lime", label: "Account verified" },
  account_rejected: { icon: ShieldX, tone: "bg-[#ff8a7a]/15 text-[#ff8a7a]", label: "Account rejected" },
  payout: { icon: Wallet, tone: "bg-lime/15 text-lime", label: "Payout" },
  info: { icon: Megaphone, tone: "bg-[#6fd3e8]/15 text-[#6fd3e8]", label: "Announcement" },
};

const isHttp = (v: string) => /^https?:\/\//i.test(v);

function relative(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(iso);
}

export function Inbox({ initialItems, initialCursor, loadError }: { initialItems: Item[]; initialCursor: string | null; loadError: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState(loadError ? "Couldn't load your inbox. Please refresh the page." : "");
  const [now, setNow] = useState<number | null>(null); // set after mount so server and client HTML match

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const unread = items.filter((i) => !i.readAt).length;

  async function markRead(ids: string[] | "all") {
    const stamp = new Date().toISOString();
    const before = items;
    setItems((list) => list.map((i) => (!i.readAt && (ids === "all" || ids.includes(i.id)) ? { ...i, readAt: stamp } : i)));
    try {
      await api("/api/portal/notifications", { method: "POST", json: ids === "all" ? { all: true } : { ids } });
      router.refresh(); // updates the bell / Inbox badge in the layout
    } catch (e) {
      setItems(before);
      setError(e instanceof Error ? e.message : "Couldn't update your inbox.");
    }
  }

  async function markAll() {
    setMarkingAll(true);
    setError("");
    await markRead("all");
    setMarkingAll(false);
  }

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    setError("");
    try {
      const res = await api<{ items: Item[]; nextCursor: string | null }>(`/api/portal/notifications?cursor=${encodeURIComponent(cursor)}`);
      setItems((list) => {
        const seen = new Set(list.map((i) => i.id));
        return [...list, ...res.items.filter((i) => !seen.has(i.id))];
      });
      setCursor(res.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load more.");
    } finally {
      setLoadingMore(false);
    }
  }

  if (!items.length && !error) {
    return (
      <EmptyState title="All quiet here.">
        When your accounts are verified, a payout lands, or the team shares a campaign update, you&apos;ll see it here.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark" aria-live="polite">
          {unread ? (
            <>
              <span className="text-lime">{unread}</span> unread
            </>
          ) : (
            "You're all caught up"
          )}
        </p>
        <button type="button" className={smallBtn} onClick={markAll} disabled={!unread || markingAll}>
          {markingAll ? <LoaderCircle size={13} className="animate-spin" /> : <CheckCheck size={13} />} Mark all read
        </button>
      </div>

      <ErrorNote>{error}</ErrorNote>

      <ul className="overflow-hidden rounded-3xl border border-line bg-ink-2">
        {items.map((n) => {
          const meta = KIND[n.kind] ?? KIND.info;
          const Icon = meta.icon;
          const isUnread = !n.readAt;
          return (
            <li
              key={n.id}
              onClick={() => isUnread && void markRead([n.id])}
              className={cn(
                "relative flex gap-4 border-b border-line/60 px-5 py-5 transition last:border-0 md:px-6",
                isUnread ? "cursor-pointer bg-lime/[0.04] hover:bg-lime/[0.07]" : "",
              )}
            >
              <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", meta.tone)} aria-hidden>
                <Icon size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-dark">{meta.label}</span>
                  {n.campaignName && (
                    <span className="truncate font-mono text-[11px] uppercase tracking-[0.14em] text-muted-dark/80">· {n.campaignName}</span>
                  )}
                  <time
                    dateTime={n.createdAt}
                    title={formatDate(n.createdAt)}
                    className="ml-auto shrink-0 font-mono text-[11px] text-muted-dark"
                  >
                    {now === null ? formatDate(n.createdAt) : relative(n.createdAt, now)}
                  </time>
                </div>
                <p className={cn("mt-1.5 flex items-start gap-2 break-words", isUnread ? "font-semibold text-cream" : "text-cream/85")}>
                  {isUnread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-lime" aria-label="Unread" />}
                  <span className="min-w-0">{n.title}</span>
                </p>
                {n.body && <p className="mt-1.5 whitespace-pre-line break-words text-sm text-muted-dark">{n.body}</p>}
                {n.reelRef && (
                  <p className="mt-2 text-sm">
                    <span className="mr-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-dark">
                      {n.kind === "info" ? "Link" : "Reel"}
                    </span>
                    {isHttp(n.reelRef) ? (
                      <a
                        href={n.reelRef}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-1 break-all text-lime underline-offset-4 hover:underline"
                      >
                        <span className="break-all">{n.reelRef}</span>
                        <ExternalLink size={12} className="shrink-0" aria-hidden />
                      </a>
                    ) : (
                      <span className="break-all text-cream/80">{n.reelRef}</span>
                    )}
                  </p>
                )}
                {isUnread && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void markRead([n.id]);
                    }}
                    className="mt-3 inline-flex items-center gap-1 text-xs text-muted-dark underline-offset-4 hover:text-lime hover:underline focus-visible:text-lime"
                  >
                    <Check size={12} /> Mark as read
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {cursor && (
        <div className="flex justify-center">
          <button type="button" className={cn(smallBtn, "px-5 py-2 text-sm")} onClick={loadMore} disabled={loadingMore}>
            {loadingMore && <LoaderCircle size={14} className="animate-spin" />} Load more
          </button>
        </div>
      )}
    </div>
  );
}
