"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Banknote, Check, LoaderCircle, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { api } from "@/lib/portal/client";
import { formatINR } from "@/lib/portal/money";
import { formatDate } from "@/lib/portal/weeks";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, ErrorNote, Label, TableWrap, errorText, field, label, smallBtn, td, th, tr } from "@/components/portal/ui";

export type ClipperBalanceRow = {
  id: string;
  name: string;
  loginId: string;
  upiId: string | null;
  earnedPaise: number;
  finesPaise: number;
  paidPaise: number;
  balancePaise: number;
};

export type PayoutRow = {
  id: string;
  clipperId: string;
  clipperName: string;
  clipperLoginId: string;
  amountPaise: number;
  paidOn: string;
  reference: string | null;
  note: string | null;
  createdByName: string;
};

type Sort = "balance-desc" | "balance-asc" | "name";

export function PayoutsManager({
  clippers,
  payouts,
  historyCapped,
  isSuper,
  today,
  loadError,
}: {
  clippers: ClipperBalanceRow[];
  payouts: PayoutRow[];
  historyCapped: boolean;
  isSuper: boolean;
  today: string;
  loadError: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("balance-desc");
  const [owedOnly, setOwedOnly] = useState(false);
  const [paying, setPaying] = useState<ClipperBalanceRow | null>(null);
  const [flash, setFlash] = useState("");
  const [historyFilter, setHistoryFilter] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState("");

  const totals = useMemo(() => {
    const owed = clippers.filter((c) => c.balancePaise > 0);
    return {
      outstanding: owed.reduce((s, c) => s + c.balancePaise, 0),
      owedCount: owed.length,
      paid: clippers.reduce((s, c) => s + c.paidPaise, 0),
    };
  }, [clippers]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = clippers.filter(
      (c) =>
        (!owedOnly || c.balancePaise > 0) &&
        (!q || c.name.toLowerCase().includes(q) || c.loginId.toLowerCase().includes(q) || (c.upiId ?? "").toLowerCase().includes(q)),
    );
    return list.sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "balance-asc"
          ? a.balancePaise - b.balancePaise
          : b.balancePaise - a.balancePaise,
    );
  }, [clippers, query, sort, owedOnly]);

  const historyClippers = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of payouts) m.set(p.clipperId, p.clipperName);
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [payouts]);
  const history = historyFilter ? payouts.filter((p) => p.clipperId === historyFilter) : payouts;

  async function remove(p: PayoutRow) {
    if (
      !window.confirm(
        `Remove the ${formatINR(p.amountPaise)} payout to ${p.clipperName} on ${formatDate(p.paidOn)}?\n\nOnly do this if it was entered by mistake. The amount goes back onto their balance and they'll get an inbox note.`,
      )
    )
      return;
    setDeletingId(p.id);
    setHistoryError("");
    try {
      await api(`/api/admin/payouts/${p.id}`, { method: "DELETE" });
      setFlash(`Removed the ${formatINR(p.amountPaise)} payout to ${p.clipperName}.`);
      router.refresh();
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : "Couldn't remove the payout.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-10">
      <ErrorNote>{loadError}</ErrorNote>

      {flash && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-lime bg-lime/10 px-4 py-3 text-sm text-cream" role="status">
          <span className="flex items-center gap-2">
            <Check size={16} className="shrink-0 text-lime" /> {flash}
          </span>
          <button type="button" onClick={() => setFlash("")} aria-label="Dismiss" className="text-muted-dark hover:text-cream">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <Label>Outstanding</Label>
          <p className="mt-3 font-display text-4xl font-bold text-lime">{formatINR(totals.outstanding)}</p>
          <p className="mt-2 text-sm text-muted-dark">Owed to {totals.owedCount} active clipper{totals.owedCount === 1 ? "" : "s"}.</p>
        </Card>
        <Card>
          <Label>Paid out (active clippers)</Label>
          <p className="mt-3 font-display text-4xl font-bold">{formatINR(totals.paid)}</p>
          <p className="mt-2 text-sm text-muted-dark">All time.</p>
        </Card>
        <Card>
          <Label>Active clippers</Label>
          <p className="mt-3 font-display text-4xl font-bold">{clippers.length}</p>
          <p className="mt-2 text-sm text-muted-dark">Balance = earned − active fines − paid.</p>
        </Card>
      </div>

      {/* Balances */}
      <section aria-labelledby="bal-h">
        <h2 id="bal-h" className="font-display text-2xl font-bold uppercase">Balances</h2>
        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-end">
          <div className="md:flex-1">
            <label htmlFor="p-search" className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark">
              Search
            </label>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-dark" aria-hidden />
              <input
                id="p-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, login ID or UPI"
                className={cn(field, "pl-10")}
              />
            </div>
          </div>
          <div className="md:w-56">
            <label htmlFor="p-sort" className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark">
              Sort
            </label>
            <select id="p-sort" className={field} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="balance-desc">Balance: high to low</option>
              <option value="balance-asc">Balance: low to high</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-2 pb-2.5 text-sm text-muted-dark">
            <input type="checkbox" checked={owedOnly} onChange={(e) => setOwedOnly(e.target.checked)} className="h-4 w-4 accent-[#C8F04A]" />
            Only clippers we owe
          </label>
        </div>

        <div className="mt-5">
          {clippers.length === 0 ? (
            <EmptyState title="No active clippers yet">Add clippers in Users — their balances show up here once weekly views are entered.</EmptyState>
          ) : rows.length === 0 ? (
            <EmptyState title="No matches">Try a different search{owedOnly ? " or untick “Only clippers we owe”" : ""}.</EmptyState>
          ) : (
            <TableWrap minWidth={920}>
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>Clipper</th>
                  <th className={th}>UPI ID</th>
                  <th className={cn(th, "text-right")}>Earned</th>
                  <th className={cn(th, "text-right")}>Fines</th>
                  <th className={cn(th, "text-right")}>Paid</th>
                  <th className={cn(th, "text-right")}>Balance</th>
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className={cn(tr, c.balancePaise > 0 && "bg-lime/[0.04]")}>
                    <td className={td}>
                      <p className="font-medium text-cream">{c.name}</p>
                      <p className="font-mono text-xs text-muted-dark">{c.loginId}</p>
                    </td>
                    <td className={cn(td, "break-all font-mono text-xs")}>{c.upiId || <span className="text-[#f5c451]">Not added</span>}</td>
                    <td className={cn(td, "text-right")}>{formatINR(c.earnedPaise)}</td>
                    <td className={cn(td, "text-right", c.finesPaise > 0 ? "text-[#ff8a7a]" : "text-muted-dark")}>{formatINR(c.finesPaise)}</td>
                    <td className={cn(td, "text-right text-muted-dark")}>{formatINR(c.paidPaise)}</td>
                    <td
                      className={cn(
                        td,
                        "text-right font-semibold",
                        c.balancePaise > 0 ? "text-lime" : c.balancePaise < 0 ? "text-[#ff8a7a]" : "text-muted-dark",
                      )}
                    >
                      {formatINR(c.balancePaise)}
                    </td>
                    <td className={cn(td, "text-right")}>
                      <button
                        type="button"
                        className={smallBtn}
                        disabled={c.balancePaise <= 0}
                        title={c.balancePaise <= 0 ? "Nothing to pay out" : undefined}
                        onClick={() => {
                          setFlash("");
                          setPaying(c);
                        }}
                      >
                        <Banknote size={14} /> Record payout
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </div>
      </section>

      {/* History */}
      <section aria-labelledby="hist-h">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="hist-h" className="font-display text-2xl font-bold uppercase">Payout history</h2>
          <div className="w-full sm:w-64">
            <label htmlFor="h-filter" className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark">
              Clipper
            </label>
            <select id="h-filter" className={field} value={historyFilter} onChange={(e) => setHistoryFilter(e.target.value)}>
              <option value="">All clippers</option>
              {historyClippers.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {historyCapped && <p className="mt-2 text-xs text-muted-dark">Showing the latest {payouts.length} payouts. Use the CSV export for the full history.</p>}
        <div className="mt-3">
          <ErrorNote>{historyError}</ErrorNote>
        </div>
        <div className="mt-3">
          {history.length === 0 ? (
            <EmptyState title="No payouts recorded yet">Use “Record payout” next to a clipper once you&apos;ve sent the money.</EmptyState>
          ) : (
            <TableWrap minWidth={860}>
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>Paid on</th>
                  <th className={th}>Clipper</th>
                  <th className={cn(th, "text-right")}>Amount</th>
                  <th className={th}>Reference</th>
                  <th className={th}>Note</th>
                  <th className={th}>Recorded by</th>
                  {isSuper && (
                    <th className={th}>
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {history.map((p) => (
                  <tr key={p.id} className={tr}>
                    <td className={cn(td, "whitespace-nowrap")}>{formatDate(p.paidOn)}</td>
                    <td className={td}>
                      <p className="text-cream">{p.clipperName}</p>
                      {p.clipperLoginId && <p className="font-mono text-xs text-muted-dark">{p.clipperLoginId}</p>}
                    </td>
                    <td className={cn(td, "text-right font-semibold text-lime")}>{formatINR(p.amountPaise)}</td>
                    <td className={cn(td, "break-all font-mono text-xs text-muted-dark")}>{p.reference || "—"}</td>
                    <td className={cn(td, "text-muted-dark")}>{p.note || "—"}</td>
                    <td className={cn(td, "text-muted-dark")}>{p.createdByName}</td>
                    {isSuper && (
                      <td className={cn(td, "text-right")}>
                        <button
                          type="button"
                          className={cn(smallBtn, "hover:border-[#ff8a7a] hover:text-[#ff8a7a]")}
                          onClick={() => remove(p)}
                          disabled={deletingId === p.id}
                          aria-label={`Delete payout of ${formatINR(p.amountPaise)} to ${p.clipperName}`}
                        >
                          {deletingId === p.id ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </div>
      </section>

      {paying && (
        <RecordPayoutDialog
          clipper={paying}
          today={today}
          onClose={() => setPaying(null)}
          onSaved={(msg) => {
            setPaying(null);
            setFlash(msg);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function RecordPayoutDialog({
  clipper,
  today,
  onClose,
  onSaved,
}: {
  clipper: ClipperBalanceRow;
  today: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [amount, setAmount] = useState((clipper.balancePaise / 100).toFixed(2));
  const [paidOn, setPaidOn] = useState(today);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Focus the amount, close on Escape, keep Tab inside the dialog, and give focus back on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    amountRef.current?.focus();
    amountRef.current?.select();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab" && dialogRef.current) {
        const items = dialogRef.current.querySelectorAll<HTMLElement>("input, textarea, button, select, a[href]");
        const list = Array.from(items).filter((el) => !el.hasAttribute("disabled"));
        if (!list.length) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const value = Number(amount);
    const next: Record<string, string> = {};
    if (!amount.trim() || !Number.isFinite(value) || value <= 0) next.amount = "Enter an amount more than ₹0";
    else if (Math.round(value * 100) > clipper.balancePaise) next.amount = `Max ${formatINR(clipper.balancePaise)}`;
    else if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) next.amount = "Use at most 2 decimal places";
    if (!paidOn) next.paidOn = "Pick a date";
    else if (paidOn > today) next.paidOn = "Can't be in the future";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      await api("/api/admin/payouts", {
        method: "POST",
        json: {
          clipperId: clipper.id,
          amount: value,
          paidOn,
          reference: reference.trim() || undefined,
          note: note.trim() || undefined,
        },
      });
      onSaved(`Recorded ${formatINR(Math.round(value * 100))} paid to ${clipper.name}. They've been notified.`);
    } catch (err) {
      const fields = (err as { fields?: Record<string, string> }).fields;
      if (fields) setErrors(fields);
      setFormError(err instanceof Error ? err.message : "Couldn't save the payout.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-ink-2 p-6 md:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-lime">{"//"} Record payout</p>
            <h2 id="pay-title" className="mt-2 font-display text-2xl font-bold uppercase">
              {clipper.name}
            </h2>
            <p className="mt-1 text-sm text-muted-dark">
              Balance <span className="font-semibold text-lime">{formatINR(clipper.balancePaise)}</span>
              {" · "}UPI <span className="font-mono text-cream">{clipper.upiId || "not added"}</span>
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-muted-dark hover:border-lime hover:text-lime">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pay-amount" className={label}>
                Amount (₹)
              </label>
              <input
                ref={amountRef}
                id="pay-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                max={(clipper.balancePaise / 100).toFixed(2)}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={field}
                aria-invalid={!!errors.amount}
                aria-describedby={errors.amount ? "pay-amount-err" : undefined}
                required
              />
              {errors.amount && (
                <p id="pay-amount-err" className={errorText}>
                  {errors.amount}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="pay-date" className={label}>
                Paid on
              </label>
              <input
                id="pay-date"
                type="date"
                max={today}
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
                className={field}
                aria-invalid={!!errors.paidOn}
                aria-describedby={errors.paidOn ? "pay-date-err" : undefined}
                required
              />
              {errors.paidOn && (
                <p id="pay-date-err" className={errorText}>
                  {errors.paidOn}
                </p>
              )}
            </div>
          </div>
          <div>
            <label htmlFor="pay-ref" className={label}>
              Reference <span className="font-normal text-muted-dark">(UPI / transaction ID)</span>
            </label>
            <input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} className={field} placeholder="e.g. 4321 8765 0099" />
            {errors.reference && <p className={errorText}>{errors.reference}</p>}
          </div>
          <div>
            <label htmlFor="pay-note" className={label}>
              Note <span className="font-normal text-muted-dark">(optional, the clipper sees it)</span>
            </label>
            <textarea id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className={field} />
            {errors.note && <p className={errorText}>{errors.note}</p>}
          </div>

          <ErrorNote>{formError}</ErrorNote>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-full border border-line px-5 py-2.5 text-sm text-muted-dark hover:text-cream">
              Cancel
            </button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Banknote size={16} />} Record payout
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
