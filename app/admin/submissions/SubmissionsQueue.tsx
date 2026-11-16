"use client";

import { Check, ExternalLink, LoaderCircle, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { api, type ApiError } from "@/lib/portal/client";
import { formatDate } from "@/lib/portal/weeks";
import { ErrorNote, PLATFORM_LABELS, Pill, TableWrap, errorText, field, smallBtn, td, th, tr } from "@/components/portal/ui";

export type QueueSubmission = {
  id: string;
  url: string;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  reject_reason: string | null;
  campaign_id: string;
  campaign_name: string;
  clipper_id: string;
  clipper_name: string;
  clipper_login: string;
  platform: string;
  username: string;
  reviewer_name: string | null;
};

const TONE = { pending: "amber", approved: "lime", rejected: "red" } as const;
const safeUrl = (v: string) => (/^https?:\/\//i.test(v) ? v : null);

export function SubmissionsQueue({ rows, tab, canFine, truncated }: { rows: QueueSubmission[]; tab: string; canFine: boolean; truncated: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [fine, setFine] = useState("");
  const [rejectError, setRejectError] = useState("");

  const pending = useMemo(() => rows.filter((r) => r.status === "pending"), [rows]);
  const allSelected = pending.length > 0 && pending.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function run(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setError("");
    try {
      await api(`/api/admin/submissions/${id}`, { method: "PATCH", json: body });
      setRejecting(null);
      setReason("");
      setFine("");
      setSelected((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      router.refresh();
    } catch (e) {
      const err = e as ApiError;
      if (body.action === "reject") setRejectError(err.message);
      else setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function bulkApprove() {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setBusy("bulk");
    setError("");
    try {
      await api("/api/admin/submissions/bulk", { method: "POST", json: { action: "approve", ids } });
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function submitReject(e: React.FormEvent, id: string) {
    e.preventDefault();
    setRejectError("");
    if (reason.trim().length < 3) {
      setRejectError("Tell the clipper why.");
      return;
    }
    const amount = fine.trim() ? Number(fine) : null;
    if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) {
      setRejectError("Enter the fine as a positive amount in ₹, or leave it empty.");
      return;
    }
    run(id, { action: "reject", reason: reason.trim(), fine: amount });
  }

  return (
    <div className="space-y-4">
      {tab === "pending" && pending.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-dark">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#C8F04A]"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(pending.slice(0, 200).map((r) => r.id)))}
            />
            Select all
          </label>
          <button type="button" className={`${smallBtn} border-lime/60 text-lime`} disabled={!selected.size || busy === "bulk"} onClick={bulkApprove}>
            {busy === "bulk" ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />} Approve selected{selected.size ? ` (${selected.size})` : ""}
          </button>
        </div>
      )}
      <ErrorNote>{error}</ErrorNote>

      <TableWrap minWidth={900}>
        <thead>
          <tr className={tr}>
            {tab === "pending" && <th className={th}><span className="sr-only">Select</span></th>}
            <th className={th}>Clipper</th>
            <th className={th}>Reel</th>
            <th className={th}>Campaign</th>
            <th className={th}>Status</th>
            <th className={th}>Submitted</th>
            <th className={th}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const link = safeUrl(r.url);
            return (
              <Fragment key={r.id}>
                <tr className={tr}>
                  {tab === "pending" && (
                    <td className={td}>
                      {r.status === "pending" && (
                        <input type="checkbox" className="h-4 w-4 accent-[#C8F04A]" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.url}`} />
                      )}
                    </td>
                  )}
                  <td className={td}>
                    <Link href={`/admin/clippers/${r.clipper_id}`} className="font-medium text-cream underline-offset-4 hover:text-lime hover:underline">{r.clipper_name}</Link>
                    <p className="font-mono text-xs text-muted-dark">{r.clipper_login}</p>
                  </td>
                  <td className={td}>
                    {link ? (
                      <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-[260px] items-center gap-1 text-lime underline-offset-4 hover:underline">
                        <span className="truncate">{r.url.replace(/^https?:\/\/(www\.)?/, "")}</span> <ExternalLink size={12} aria-hidden />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    ) : (
                      <span className="break-all text-xs">{r.url}</span>
                    )}
                    <p className="mt-1 text-xs text-muted-dark">{PLATFORM_LABELS[r.platform] ?? r.platform} · @{r.username}</p>
                    {r.note && <p className="mt-1 text-xs text-muted-dark">“{r.note}”</p>}
                  </td>
                  <td className={td}>{r.campaign_name}</td>
                  <td className={td}>
                    <Pill tone={TONE[r.status]}>{r.status}</Pill>
                    {r.status !== "pending" && r.reviewer_name && <p className="mt-1 text-xs text-muted-dark">{r.reviewer_name} · {formatDate(r.reviewed_at)}</p>}
                    {r.status === "rejected" && r.reject_reason && <p className="mt-1 max-w-[220px] text-xs text-[#ff8a7a]">{r.reject_reason}</p>}
                  </td>
                  <td className={`${td} whitespace-nowrap text-xs text-muted-dark`}>{formatDate(r.created_at)}</td>
                  <td className={`${td} text-right`}>
                    <div className="flex flex-wrap justify-end gap-2">
                      {r.status === "pending" && (
                        <button type="button" className={`${smallBtn} border-lime/60 text-lime`} disabled={busy === r.id} onClick={() => run(r.id, { action: "approve" })}>
                          {busy === r.id ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />} Approve
                        </button>
                      )}
                      {r.status !== "rejected" && (
                        <button type="button" className={smallBtn} onClick={() => { setRejecting(rejecting === r.id ? null : r.id); setRejectError(""); }}>
                          <X size={13} /> Reject
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {rejecting === r.id && (
                  <tr className="border-b border-line/60 bg-ink">
                    <td colSpan={tab === "pending" ? 7 : 6} className="px-5 py-4">
                      <form onSubmit={(e) => submitReject(e, r.id)} className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-start">
                        <div>
                          <label htmlFor={`why-${r.id}`} className="mb-1 block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark">Why reject? (the clipper sees this)</label>
                          <textarea id={`why-${r.id}`} className={field} rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Used footage outside the approved assets" autoFocus />
                        </div>
                        {canFine && (
                          <div>
                            <label htmlFor={`fine-${r.id}`} className="mb-1 block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark">Fine ₹ (optional)</label>
                            <input id={`fine-${r.id}`} className={field} inputMode="decimal" value={fine} onChange={(e) => setFine(e.target.value)} placeholder="0" />
                          </div>
                        )}
                        <div className="flex gap-2 md:pt-5">
                          <button type="submit" className={`${smallBtn} border-[#ff8a7a]/60 text-[#ff8a7a]`} disabled={busy === r.id}>
                            {busy === r.id && <LoaderCircle size={13} className="animate-spin" />} Reject
                          </button>
                          <button type="button" className={smallBtn} onClick={() => setRejecting(null)}>Cancel</button>
                        </div>
                        {rejectError && <p className={`${errorText} md:col-span-3`} role="alert">{rejectError}</p>}
                      </form>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </TableWrap>
      {truncated && <p className="text-xs text-muted-dark">Showing the first 300. Use search or filters to narrow it down.</p>}
    </div>
  );
}
