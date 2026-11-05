"use client";

import { ChevronDown, LoaderCircle, RotateCcw } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/portal/client";
import { EmptyState, ErrorNote, Label, Pill, field, smallBtn } from "@/components/portal/ui";
import type { ActivityEntry } from "@/app/api/admin/activity/load";
import { actionLabel, actionTone } from "./labels";

type Page = { entries: ActivityEntry[]; hasMore: boolean; nextOffset: number };
type Actor = { id: string; name: string; loginId: string; role: string };

const ROLE = { super_admin: "Super admin", admin: "Staff", clipper: "Clipper" } as Record<string, string>;

function when(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function short(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v.length > 60 ? `${v.slice(0, 57)}…` : v || "“”";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === "object" ? "…" : String(x))).join(", ") : "none";
  return "{…}";
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Compact one-line-per-field summary of what changed. */
function changes(before: unknown, after: unknown): Array<{ key: string; from?: string; to: string }> {
  if (isObj(before) && isObj(after)) {
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    return keys
      .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
      .map((k) => ({ key: k, from: short(before[k]), to: short(after[k]) }));
  }
  if (isObj(after)) return Object.entries(after).map(([k, v]) => ({ key: k, to: short(v) }));
  if (isObj(before)) return Object.entries(before).map(([k, v]) => ({ key: k, from: short(v), to: "removed" }));
  if (after !== null && after !== undefined) return [{ key: "value", to: short(after) }];
  return [];
}

function Entry({ e }: { e: ActivityEntry }) {
  const list = changes(e.before, e.after);
  const preview = list.slice(0, 3);
  const hasDetails = e.before != null || e.after != null;
  return (
    <li className="border-b border-line/60 px-5 py-4 last:border-0 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={actionTone(e.action)}>{actionLabel(e.action)}</Pill>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-dark">{e.entity}</span>
          </div>
          <p className="mt-2 text-sm">
            {e.actor ? (
              <>
                <span className="font-medium text-cream">{e.actor.name}</span>{" "}
                <span className="font-mono text-xs text-muted-dark">
                  @{e.actor.loginId} · {ROLE[e.actor.role] ?? e.actor.role}
                </span>
              </>
            ) : (
              <span className="text-muted-dark">System / removed user</span>
            )}
          </p>
        </div>
        <time className="shrink-0 font-mono text-xs text-muted-dark" dateTime={e.created_at}>
          {when(e.created_at)}
        </time>
      </div>

      {preview.length > 0 && (
        <ul className="mt-2 space-y-0.5 break-words text-xs text-muted-dark">
          {preview.map((c) => (
            <li key={c.key}>
              <span className="font-mono text-cream/80">{c.key}</span>:{" "}
              {c.from !== undefined && (
                <>
                  <span className="line-through decoration-[#ff8a7a]/60">{c.from}</span> →{" "}
                </>
              )}
              <span className="text-cream">{c.to}</span>
            </li>
          ))}
          {list.length > preview.length && <li>+ {list.length - preview.length} more</li>}
        </ul>
      )}

      {hasDetails && (
        <details className="group mt-2">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded font-mono text-[11px] uppercase tracking-[0.14em] text-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/60">
            Full details <ChevronDown size={13} className="transition group-open:rotate-180" />
          </summary>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {(["before", "after"] as const).map((k) => (
              <div key={k} className="min-w-0 rounded-2xl border border-line bg-ink p-3">
                <Label>{k}</Label>
                <pre className="mt-1.5 max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-muted-dark">
                  {e[k] == null ? "—" : JSON.stringify(e[k], null, 2)}
                </pre>
              </div>
            ))}
          </div>
          {e.entity_id && <p className="mt-2 font-mono text-[11px] text-muted-dark">ID {e.entity_id}</p>}
        </details>
      )}
    </li>
  );
}

export function ActivityLog({ initial, actions, actors }: { initial: Page | null; actions: string[]; actors: Actor[] }) {
  const [entries, setEntries] = useState<ActivityEntry[]>(initial?.entries ?? []);
  const [hasMore, setHasMore] = useState(initial?.hasMore ?? false);
  const [offset, setOffset] = useState(initial?.nextOffset ?? 0);
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initial ? "" : "Couldn't load the activity log. Try again.");

  async function load(opts: { action: string; actor: string; offset: number; append: boolean }) {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ offset: String(opts.offset) });
      if (opts.action) qs.set("action", opts.action);
      if (opts.actor) qs.set("actor", opts.actor);
      const page = await api<Page & { ok: true }>(`/api/admin/activity?${qs}`);
      setEntries((prev) => (opts.append ? [...prev, ...page.entries] : page.entries));
      setHasMore(page.hasMore);
      setOffset(page.nextOffset);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const applyFilter = (next: { action?: string; actor?: string }) => {
    const a = next.action ?? action;
    const b = next.actor ?? actor;
    setAction(a);
    setActor(b);
    load({ action: a, actor: b, offset: 0, append: false });
  };

  const staff = actors.filter((a) => a.role !== "clipper");
  const clippers = actors.filter((a) => a.role === "clipper");

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-64">
          <label htmlFor="f-action" className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark">
            Action
          </label>
          <select id="f-action" className={field} value={action} onChange={(e) => applyFilter({ action: e.target.value })}>
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {actionLabel(a)}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:w-72">
          <label htmlFor="f-actor" className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark">
            Done by
          </label>
          <select id="f-actor" className={field} value={actor} onChange={(e) => applyFilter({ actor: e.target.value })}>
            <option value="">Everyone</option>
            {staff.length > 0 && (
              <optgroup label="Staff">
                {staff.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} (@{a.loginId})
                  </option>
                ))}
              </optgroup>
            )}
            {clippers.length > 0 && (
              <optgroup label="Clippers">
                {clippers.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} (@{a.loginId})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
        {(action || actor) && (
          <button type="button" className={smallBtn} onClick={() => applyFilter({ action: "", actor: "" })}>
            <RotateCcw size={13} /> Clear filters
          </button>
        )}
        {loading && <LoaderCircle size={18} className="animate-spin text-lime sm:mb-3" aria-label="Loading" />}
      </div>

      <ErrorNote>{error}</ErrorNote>

      {entries.length === 0 && !loading && !error ? (
        <EmptyState title="Nothing here yet.">
          {action || actor ? "No activity matches these filters." : "Actions like adding users, saving views and recording payouts will show up here."}
        </EmptyState>
      ) : (
        entries.length > 0 && <ul className="overflow-hidden rounded-3xl border border-line bg-ink-2">{entries.map((e) => <Entry key={e.id} e={e} />)}</ul>
      )}

      {hasMore && (
        <div className="text-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => load({ action, actor, offset, append: true })}
            className="inline-flex items-center gap-2 rounded-full border border-line px-6 py-2.5 text-sm text-cream transition hover:border-lime hover:text-lime disabled:opacity-60"
          >
            {loading && <LoaderCircle size={15} className="animate-spin" />} Load more
          </button>
        </div>
      )}
    </div>
  );
}
