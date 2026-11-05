"use client";

import { CircleCheck, Eraser, Keyboard, LoaderCircle, Save, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { api } from "@/lib/portal/client";
import { amountForViews, compactViews, formatINR, formatViews } from "@/lib/portal/money";
import { formatDate, formatWeek } from "@/lib/portal/weeks";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, ErrorNote, Label, Pill, PLATFORM_LABELS, TableWrap, field, smallBtn, td, th, tr } from "@/components/portal/ui";
import type { Grid, GridRow } from "./data";

// New entries need a verified account; a saved row can still be corrected after a revoke.
const canEdit = (r: GridRow) => r.linked && (r.accountStatus === "verified" || !!r.saved);

type CampaignOption = { id: string; name: string; client: string | null; status: string };

type RowState = "saved" | "changed" | "empty" | "invalid" | "unchanged-blank";

const MAX_VIEWS = 1_000_000_000_000;

/** "12,40,000" / "1240000" / " 1 240 000 " → 1240000. null = blank, NaN = not a valid count. */
function parseViews(raw: string): number | null {
  const s = raw.replace(/[\s,_]/g, "");
  if (s === "") return null;
  if (!/^\d+$/.test(s)) return NaN;
  const n = Number(s);
  return n > MAX_VIEWS ? NaN : n;
}

const initialInputs = (rows: GridRow[]) => Object.fromEntries(rows.map((r) => [r.accountId, r.saved ? String(r.saved.views) : ""]));

export function ViewsEntry({
  campaigns,
  weeks,
  currentWeek,
  initialGrid,
  isSuper,
}: {
  campaigns: CampaignOption[];
  weeks: string[];
  currentWeek: string;
  initialGrid: Grid;
  isSuper: boolean;
}) {
  const router = useRouter();
  const [grid, setGrid] = useState<Grid>(initialGrid);
  const [inputs, setInputs] = useState<Record<string, string>>(() => initialInputs(initialGrid.rows));
  const [saving, setSaving] = useState(false);
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const { campaign, weekStart, rows } = grid;
  const editableRows = useMemo(() => rows.filter(canEdit), [rows]);

  // Per-row derived state: what the row would hold after saving.
  const derived = useMemo(() => {
    const map = new Map<string, { state: RowState; views: number | null; rate: number; amount: number | null }>();
    for (const r of rows) {
      const rate = r.saved ? r.saved.ratePerMillionPaise : campaign.ratePerMillionPaise;
      const parsed = parseViews(inputs[r.accountId] ?? "");
      let state: RowState;
      let views: number | null = r.saved?.views ?? null;
      if (parsed === null) state = r.saved ? "unchanged-blank" : "empty";
      else if (Number.isNaN(parsed)) state = "invalid";
      else if (r.saved && parsed === r.saved.views) state = "saved";
      else {
        state = "changed";
        views = parsed;
      }
      const amount = views === null ? null : state === "changed" ? amountForViews(views, rate) : r.saved!.amountPaise;
      map.set(r.accountId, { state, views, rate, amount });
    }
    return map;
  }, [rows, inputs, campaign.ratePerMillionPaise]);

  const changed = useMemo(
    () => editableRows.filter((r) => derived.get(r.accountId)?.state === "changed"),
    [editableRows, derived],
  );
  const invalidCount = useMemo(
    () => editableRows.filter((r) => derived.get(r.accountId)?.state === "invalid").length,
    [editableRows, derived],
  );
  const dirty = changed.length > 0 || invalidCount > 0;

  const totals = useMemo(() => {
    let views = 0;
    let amount = 0;
    let entered = 0;
    const byClipper = new Map<string, { id: string; name: string; terminated: boolean; accounts: number; views: number; amount: number }>();
    for (const r of rows) {
      const d = derived.get(r.accountId)!;
      const c = byClipper.get(r.clipperId) ?? { id: r.clipperId, name: r.clipperName, terminated: r.clipperTerminated, accounts: 0, views: 0, amount: 0 };
      c.accounts += 1;
      if (d.views !== null) {
        views += d.views;
        amount += d.amount ?? 0;
        entered += 1;
        c.views += d.views;
        c.amount += d.amount ?? 0;
      }
      byClipper.set(r.clipperId, c);
    }
    return { views, amount, entered, byClipper: Array.from(byClipper.values()).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name)) };
  }, [rows, derived]);

  const flagged = rows.filter((r) => r.linked && (r.accountStatus !== "verified" || r.clipperTerminated)).length;
  const unlinkedSaved = rows.filter((r) => !r.linked).length;
  const rateChanged = rows.some((r) => r.saved && r.saved.ratePerMillionPaise !== campaign.ratePerMillionPaise);

  // ---- saving ---------------------------------------------------------------------------------

  const save = useCallback(async () => {
    if (saving) return;
    setError("");
    setNotice("");
    if (invalidCount > 0) {
      setError(`${invalidCount} row${invalidCount === 1 ? " has" : "s have"} an invalid number. Use whole numbers only (commas are fine).`);
      return;
    }
    if (changed.length === 0) {
      setNotice("Nothing new to save.");
      return;
    }
    setSaving(true);
    try {
      const data = await api<{ saved: number; grid?: Grid }>("/api/admin/views", {
        method: "POST",
        json: {
          campaignId: campaign.id,
          weekStart,
          rows: changed.map((r) => ({ accountId: r.accountId, views: derived.get(r.accountId)!.views })),
        },
      });
      if (data.grid) {
        setGrid(data.grid);
        setInputs(initialInputs(data.grid.rows));
      } else {
        router.refresh();
      }
      setNotice(`Saved ${data.saved} row${data.saved === 1 ? "" : "s"}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [saving, invalidCount, changed, campaign.id, weekStart, derived, router]);

  async function clearRow(r: GridRow) {
    if (!r.saved) return;
    const ok = window.confirm(
      `Clear the saved entry for @${r.username} (${r.clipperName}) — ${formatViews(r.saved.views)} views, ${formatINR(r.saved.amountPaise)} — for ${formatWeek(weekStart)}?\n\nThis removes the earning from their wallet.`,
    );
    if (!ok) return;
    setClearingId(r.accountId);
    setError("");
    setNotice("");
    try {
      const data = await api<{ grid?: Grid }>("/api/admin/views", {
        method: "DELETE",
        json: { campaignId: campaign.id, weekStart, accountId: r.accountId },
      });
      if (data.grid) {
        const next = data.grid;
        setGrid(next);
        // keep any other unsaved edits; reset only the cleared row
        setInputs((prev) => ({ ...initialInputs(next.rows), ...Object.fromEntries(Object.entries(prev).filter(([k]) => k !== r.accountId)) }));
      } else router.refresh();
      setNotice(`Cleared the entry for @${r.username}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't clear the entry.");
    } finally {
      setClearingId(null);
    }
  }

  // Ctrl/Cmd + Enter saves from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  // Warn before leaving with unsaved changes: tab close/reload, and in-app link clicks.
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.origin !== window.location.origin) return;
      if (!window.confirm("You have unsaved views. Leave without saving?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  function go(next: { campaign?: string; week?: string }) {
    if (dirty && !window.confirm("You have unsaved views. Switch without saving?")) return;
    const params = new URLSearchParams({ campaign: next.campaign ?? campaign.id, week: next.week ?? weekStart });
    router.push(`/admin/views?${params.toString()}`);
  }

  function focusRow(i: number) {
    const el = inputRefs.current[i];
    if (el) {
      el.focus();
      el.select();
    }
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) return; // handled globally
    if (e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      focusRow(i + 1 < editableRows.length ? i + 1 : i);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusRow(Math.max(0, i - 1));
    }
  }

  // ---- render ---------------------------------------------------------------------------------

  const statusPill = (r: GridRow) => {
    const d = derived.get(r.accountId)!;
    if (d.state === "invalid") return <Pill tone="red">Invalid</Pill>;
    if (d.state === "changed") return <Pill tone="amber">Unsaved</Pill>;
    if (r.saved)
      return (
        <span className="flex flex-col gap-1">
          <Pill tone="lime">Saved</Pill>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-dark">{formatDate(r.saved.updatedAt)}</span>
        </span>
      );
    return <Pill tone="grey">Not entered</Pill>;
  };

  let editIndex = -1;

  return (
    <div className="space-y-6">
      {/* Pickers */}
      <Card className="grid gap-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div>
          <label htmlFor="views-campaign" className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark">
            Campaign
          </label>
          <select id="views-campaign" className={field} value={campaign.id} onChange={(e) => go({ campaign: e.target.value })}>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.client ? ` — ${c.client}` : ""}
                {c.status !== "active" ? ` (${c.status})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="views-week" className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark">
            Week (Mon – Sun, IST)
          </label>
          <select id="views-week" className={field} value={weekStart} onChange={(e) => go({ week: e.target.value })}>
            {weeks.map((w) => (
              <option key={w} value={w}>
                {formatWeek(w)}
                {w === currentWeek ? " (this week, in progress)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="rounded-2xl border border-line bg-ink px-4 py-3">
          <Label>Campaign rate</Label>
          <p className="mt-1 font-display text-xl font-bold text-lime">
            {formatINR(campaign.ratePerMillionPaise)} <span className="font-sans text-xs font-normal text-muted-dark">/ 1M views</span>
          </p>
        </div>
      </Card>

      {/* Notices */}
      {weekStart === currentWeek && (
        <p className="flex items-start gap-2 rounded-2xl border border-[#f5c451]/40 bg-[#f5c451]/10 px-4 py-3 text-sm text-[#f5c451]">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          This week isn&apos;t over yet. Entries saved now will show in clippers&apos; wallets straight away.
        </p>
      )}
      {flagged > 0 && (
        <p className="flex items-start gap-2 rounded-2xl border border-[#f5c451]/40 bg-[#f5c451]/10 px-4 py-3 text-sm text-[#f5c451]">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          {flagged} account{flagged === 1 ? " is" : "s are"} no longer verified or belong{flagged === 1 ? "s" : ""} to a terminated clipper. You can
          still enter views — double-check before you do.
        </p>
      )}
      {unlinkedSaved > 0 && (
        <p className="flex items-start gap-2 rounded-2xl border border-line px-4 py-3 text-sm text-muted-dark">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          {unlinkedSaved} saved entr{unlinkedSaved === 1 ? "y belongs" : "ies belong"} to an account that is no longer linked to this campaign. It
          still counts in the totals{isSuper ? " — clear it if it shouldn't." : "; ask the super admin if it should be cleared."}
        </p>
      )}
      {rateChanged && (
        <p className="text-sm text-muted-dark">
          Some rows were first saved at an older rate — they keep that rate. New rows use the current {formatINR(campaign.ratePerMillionPaise)} / 1M.
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState title="No accounts linked to this campaign yet.">
          Clippers join the campaign and link their verified social accounts from their portal. Once they do, each account shows up here
          for you to enter its weekly views.
        </EmptyState>
      ) : (
        <>
          <TableWrap minWidth={860}>
            <thead>
              <tr className="border-b border-line">
                <th className={th}>Clipper</th>
                <th className={th}>Account</th>
                <th className={cn(th, "text-right")}>Last week</th>
                <th className={cn(th, "w-[190px]")}>This week&apos;s views</th>
                <th className={cn(th, "text-right")}>Amount</th>
                <th className={th}>Status</th>
                {isSuper && <th className={th}><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const d = derived.get(r.accountId)!;
                const idx = canEdit(r) ? ++editIndex : -1;
                const inputId = `views-${r.accountId}`;
                return (
                  <tr
                    key={r.accountId}
                    className={cn(
                      tr,
                      d.state === "changed" && "bg-[#f5c451]/[0.07]",
                      d.state === "invalid" && "bg-[#ff8a7a]/[0.08]",
                      !r.linked && "opacity-70",
                    )}
                  >
                    <td className={td}>
                      <p className="font-medium text-cream">{r.clipperName}</p>
                      {r.clipperLoginId && <p className="font-mono text-xs text-muted-dark">{r.clipperLoginId}</p>}
                      {r.clipperTerminated && (
                        <span className="mt-1.5 inline-block">
                          <Pill tone="red">Terminated</Pill>
                        </span>
                      )}
                    </td>
                    <td className={td}>
                      <p className="text-cream">@{r.username}</p>
                      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-dark">{PLATFORM_LABELS[r.platform] ?? r.platform}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {r.accountStatus !== "verified" && <Pill tone="amber">{r.accountStatus === "pending" ? "Not verified" : "Rejected"}</Pill>}
                        {!r.linked && <Pill tone="grey">Unlinked</Pill>}
                      </div>
                    </td>
                    <td className={cn(td, "text-right font-mono text-muted-dark")}>
                      {r.lastWeekViews === null ? "—" : formatViews(r.lastWeekViews)}
                    </td>
                    <td className={td}>
                      <label htmlFor={inputId} className="sr-only">
                        Views for @{r.username} ({r.clipperName})
                      </label>
                      <input
                        id={inputId}
                        ref={(el) => {
                          if (idx >= 0) inputRefs.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        spellCheck={false}
                        disabled={!canEdit(r) || saving}
                        placeholder={canEdit(r) ? "0" : "—"}
                        value={inputs[r.accountId] ?? ""}
                        onChange={(e) => setInputs((prev) => ({ ...prev, [r.accountId]: e.target.value }))}
                        onKeyDown={(e) => onInputKey(e, idx)}
                        onFocus={(e) => e.currentTarget.select()}
                        aria-invalid={d.state === "invalid"}
                        className={cn(
                          field,
                          "text-right font-mono",
                          d.state === "changed" && "border-[#f5c451]",
                          d.state === "invalid" && "border-[#ff8a7a]",
                        )}
                      />
                      {d.state === "unchanged-blank" && <p className="mt-1 text-[11px] text-muted-dark">Blank = keep {formatViews(r.saved!.views)}</p>}
                      {d.state === "changed" && d.views !== null && d.views >= 1000 && (
                        <p className="mt-1 text-right font-mono text-[11px] text-muted-dark">{formatViews(d.views)} · {compactViews(d.views)}</p>
                      )}
                    </td>
                    <td className={cn(td, "text-right font-mono")}>
                      {d.amount === null ? <span className="text-muted-dark">—</span> : <span className={d.state === "changed" ? "text-[#f5c451]" : "text-cream"}>{formatINR(d.amount)}</span>}
                    </td>
                    <td className={td}>{statusPill(r)}</td>
                    {isSuper && (
                      <td className={cn(td, "text-right")}>
                        {r.saved && (
                          <button
                            type="button"
                            className={cn(smallBtn, "hover:border-[#ff8a7a] hover:text-[#ff8a7a]")}
                            onClick={() => clearRow(r)}
                            disabled={clearingId !== null || saving}
                            aria-label={`Clear saved views for @${r.username}`}
                          >
                            {clearingId === r.accountId ? <LoaderCircle size={13} className="animate-spin" /> : <Eraser size={13} />} Clear
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-ink">
                <td className={td} colSpan={3}>
                  <Label>Week total · {totals.entered} of {rows.length} accounts entered</Label>
                </td>
                <td className={cn(td, "text-right font-mono font-semibold text-cream")}>{formatViews(totals.views)}</td>
                <td className={cn(td, "text-right font-mono font-semibold text-lime")}>{formatINR(totals.amount)}</td>
                <td className={td} colSpan={isSuper ? 2 : 1} />
              </tr>
            </tfoot>
          </TableWrap>

          {/* Save bar */}
          <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-3xl border border-line bg-ink-2/95 p-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              {changed.length > 0 ? (
                <span className="text-[#f5c451]">
                  {changed.length} unsaved change{changed.length === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-muted-dark">
                  <CircleCheck size={15} className="text-lime" /> All changes saved
                </span>
              )}
              <span className="ml-3 hidden items-center gap-1.5 text-xs text-muted-dark md:inline-flex">
                <Keyboard size={14} /> ↓ / Enter next · ↑ previous · Ctrl/⌘ + Enter save
              </span>
              <div className="mt-1">
                <ErrorNote>{error}</ErrorNote>
                {notice && !error && <p className="text-sm text-lime" role="status">{notice}</p>}
              </div>
            </div>
            <Button size="sm" onClick={() => void save()} disabled={saving || changed.length === 0} className="w-full sm:w-auto">
              {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "Saving…" : changed.length > 0 ? `Save ${changed.length} change${changed.length === 1 ? "" : "s"}` : "Save"}
            </Button>
          </div>

          {/* Per-clipper summary */}
          <div>
            <Label className="mb-3">By clipper · {formatWeek(weekStart)}</Label>
            <TableWrap minWidth={480}>
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>Clipper</th>
                  <th className={cn(th, "text-right")}>Accounts</th>
                  <th className={cn(th, "text-right")}>Views</th>
                  <th className={cn(th, "text-right")}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {totals.byClipper.map((c) => (
                  <tr key={c.id} className={tr}>
                    <td className={td}>
                      {c.name} {c.terminated && <Pill tone="red">Terminated</Pill>}
                    </td>
                    <td className={cn(td, "text-right font-mono text-muted-dark")}>{c.accounts}</td>
                    <td className={cn(td, "text-right font-mono")}>{formatViews(c.views)}</td>
                    <td className={cn(td, "text-right font-mono text-lime")}>{formatINR(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            {changed.length > 0 && <p className="mt-2 text-xs text-muted-dark">Totals include unsaved changes.</p>}
          </div>
        </>
      )}
    </div>
  );
}
