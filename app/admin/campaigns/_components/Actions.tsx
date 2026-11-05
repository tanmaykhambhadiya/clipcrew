"use client";

import { LoaderCircle, Plus, Search, Trash2, UserMinus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorNote, field, label, smallBtn } from "@/components/portal/ui";
import { api } from "@/lib/portal/client";

const dangerBtn = `${smallBtn} hover:border-[#ff8a7a] hover:text-[#ff8a7a]`;
const message = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

type Person = { id: string; login_id: string; full_name: string };

/* ---------------------------------------------------------------- staff (super admin) */

export function StaffManager({ campaignId, assigned, available }: { campaignId: string; assigned: Person[]; available: Person[] }) {
  const router = useRouter();
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function call(method: "POST" | "DELETE", staffId: string) {
    setBusy(staffId);
    setError("");
    try {
      await api(`/api/admin/campaigns/${campaignId}/staff`, { method, json: { staffId } });
      setPick("");
      router.refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  }

  const options = available.filter((s) => !assigned.some((a) => a.id === s.id));

  return (
    <div className="space-y-4">
      {assigned.length === 0 ? (
        <p className="text-sm text-muted-dark">No staff assigned yet. Only you (super admin) can work on this campaign.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {assigned.map((s) => (
            <li key={s.id} className="inline-flex items-center gap-2 rounded-full border border-line bg-ink py-1.5 pl-3.5 pr-1.5 text-sm">
              <span>{s.full_name} <span className="font-mono text-xs text-muted-dark">{s.login_id}</span></span>
              <button type="button" className="rounded-full p-1 text-muted-dark hover:bg-line hover:text-[#ff8a7a] disabled:opacity-50"
                aria-label={`Remove ${s.full_name} from this campaign`} disabled={busy === s.id}
                onClick={() => confirm(`Remove ${s.full_name} from this campaign? They will no longer see it.`) && call("DELETE", s.id)}>
                {busy === s.id ? <LoaderCircle size={14} className="animate-spin" /> : <X size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
      {options.length > 0 ? (
        <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); if (pick) call("POST", pick); }}>
          <div className="flex-1">
            <label htmlFor="staff-pick" className={label}>Assign staff</label>
            <select id="staff-pick" className={field} value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Choose a staff member…</option>
              {options.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.login_id})</option>)}
            </select>
          </div>
          <Button type="submit" size="sm" disabled={!pick || !!busy}><Plus size={16} aria-hidden /> Assign</Button>
        </form>
      ) : (
        <p className="text-xs text-muted-dark">Every active staff member is already assigned. Add staff from Users.</p>
      )}
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}

/* ---------------------------------------------------------------- add clippers */

export function ClipperAdder({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Person[] | null>(null);
  const [selected, setSelected] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const seq = useRef(0);

  useEffect(() => {
    if (!open) return;
    const n = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await api<{ clippers: Person[] }>(`/api/admin/campaigns/${campaignId}/clippers?q=${encodeURIComponent(q)}`);
        if (n === seq.current) setResults(data.clippers);
      } catch (e) {
        if (n === seq.current) setError(message(e));
      } finally {
        if (n === seq.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, open, campaignId]);

  const toggle = (p: Person) =>
    setSelected((s) => (s.some((x) => x.id === p.id) ? s.filter((x) => x.id !== p.id) : [...s, p]));

  async function add() {
    if (selected.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const data = await api<{ added: number }>(`/api/admin/campaigns/${campaignId}/clippers`, {
        method: "POST",
        json: { clipperIds: selected.map((s) => s.id) },
      });
      setDone(`Added ${data.added} clipper${data.added === 1 ? "" : "s"}. They've been notified in their inbox.`);
      setSelected([]);
      setQ("");
      setResults(null);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <Button size="sm" onClick={() => { setOpen(true); setDone(""); }}><Plus size={16} aria-hidden /> Add clippers</Button>
        {done && <p className="text-sm text-lime" role="status">{done}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-line bg-ink p-5">
      <label htmlFor="clipper-search" className={label}>Find active clippers</label>
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-dark" aria-hidden />
        <input id="clipper-search" className={`${field} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or login ID" autoFocus autoComplete="off" />
      </div>

      {selected.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selected.map((p) => (
            <button key={p.id} type="button" onClick={() => toggle(p)} className="inline-flex items-center gap-1.5 rounded-full bg-lime/15 px-3 py-1 text-xs text-lime" aria-label={`Unselect ${p.full_name}`}>
              {p.full_name} <X size={12} aria-hidden />
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 max-h-64 overflow-y-auto rounded-2xl border border-line">
        {loading && results === null ? (
          <p className="px-4 py-3 text-sm text-muted-dark">Searching…</p>
        ) : results && results.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-dark">{q ? "No matching clippers who aren't already in this campaign." : "Every active clipper is already in this campaign."}</p>
        ) : (
          <ul>
            {results?.map((p) => {
              const on = selected.some((x) => x.id === p.id);
              return (
                <li key={p.id} className="border-b border-line/60 last:border-0">
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-ink-2">
                    <input type="checkbox" className="h-4 w-4 accent-[#C8F04A]" checked={on} onChange={() => toggle(p)} />
                    <span className="min-w-0 flex-1 truncate">{p.full_name}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-dark">{p.login_id}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={add} disabled={saving || selected.length === 0}>
          {saving ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : <Plus size={16} aria-hidden />}
          Add {selected.length || ""} {selected.length === 1 ? "clipper" : "clippers"}
        </Button>
        <button type="button" className={smallBtn} onClick={() => { setOpen(false); setSelected([]); setError(""); }}>Cancel</button>
      </div>
      <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>
    </div>
  );
}

/* ---------------------------------------------------------------- remove a clipper */

export function RemoveClipperButton({ campaignId, clipperId, name }: { campaignId: string; clipperId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (!confirm(`Remove ${name} from this campaign?\n\nTheir accounts are unlinked from it. Weekly views already entered (and what they earned) are kept.`)) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/campaigns/${campaignId}/clippers`, { method: "DELETE", json: { clipperId } });
      router.refresh();
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" className={dangerBtn} onClick={remove} disabled={busy}>
        {busy ? <LoaderCircle size={13} className="animate-spin" aria-hidden /> : <UserMinus size={13} aria-hidden />} Remove
      </button>
      {error && <p className="max-w-[200px] text-right text-xs text-[#ff8a7a]" role="alert">{error}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- delete campaign (super admin) */

export function DeleteCampaign({ campaignId, name, hasViews }: { campaignId: string; name: string; hasViews: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (!confirm(`Delete "${name}" for good?\n\nIts clipper and staff assignments and linked accounts are removed. This can't be undone.`)) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/campaigns/${campaignId}`, { method: "DELETE" });
      router.push("/admin/campaigns");
      router.refresh();
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  }

  if (hasViews) {
    return (
      <p className="text-sm text-muted-dark">
        This campaign already has weekly views, so it can&apos;t be deleted — that would erase clippers&apos; earnings. Set its status to <span className="text-cream">Ended</span> instead.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-dark">No views have been entered yet, so this campaign can still be deleted.</p>
      <button type="button" className={dangerBtn} onClick={remove} disabled={busy}>
        {busy ? <LoaderCircle size={13} className="animate-spin" aria-hidden /> : <Trash2 size={13} aria-hidden />} Delete campaign
      </button>
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}
