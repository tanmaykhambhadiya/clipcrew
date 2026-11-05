"use client";

import { Ban, ExternalLink, Gavel, LoaderCircle, Megaphone, RotateCcw, Send, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { api, type ApiError } from "@/lib/portal/client";
import { formatINR } from "@/lib/portal/money";
import { formatDate } from "@/lib/portal/weeks";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, ErrorNote, Label, Pill, TableWrap, errorText, field, label, smallBtn, td, th, tr } from "@/components/portal/ui";

type CampaignOpt = { id: string; name: string; status: string };
type ClipperOpt = { id: string; name: string; loginId: string };
type Mode = "reject" | "fine" | "announce";

type Props = {
  modes: Record<Mode, boolean>;
  isSuper: boolean;
  campaigns: CampaignOpt[];
  members: Record<string, string[]>;
  clippers: ClipperOpt[];
};

const MODE_META: Record<Mode, { label: string; icon: typeof Ban; hint: string }> = {
  reject: { label: "Reject a reel", icon: Ban, hint: "Tell a clipper a reel broke the rules. Its views won't be counted." },
  fine: { label: "Fine only", icon: Gavel, hint: "Add a fine without rejecting a specific reel." },
  announce: { label: "Announcement", icon: Megaphone, hint: "Share news or a brief with a campaign's clippers." },
};

const isHttp = (v: string | null | undefined) => !!v && /^https?:\/\//i.test(v);

function Field({ id, title, error, hint, children }: { id: string; title: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {title}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted-dark">{hint}</p>}
      {error && (
        <p id={`${id}-err`} className={errorText}>
          {error}
        </p>
      )}
    </div>
  );
}

function SuccessNote({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p role="status" className="rounded-2xl border border-lime/40 bg-lime/10 px-4 py-3 text-sm text-lime">
      {text}
    </p>
  );
}

function clipperLabel(c: ClipperOpt) {
  return `${c.name} (@${c.loginId})`;
}

/* ───────────────────────── forms ───────────────────────── */

function useClipperLookup(clippers: ClipperOpt[]) {
  return useMemo(() => new Map(clippers.map((c) => [c.id, c])), [clippers]);
}

function membersOf(campaignId: string, members: Record<string, string[]>, lookup: Map<string, ClipperOpt>) {
  return (members[campaignId] ?? [])
    .map((id) => lookup.get(id))
    .filter((c): c is ClipperOpt => !!c)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function RejectForm({ campaigns, members, clippers, canFine, onSent }: Omit<Props, "modes" | "isSuper"> & { canFine: boolean; onSent: () => void }) {
  const lookup = useClipperLookup(clippers);
  const empty = { campaignId: "", clipperId: "", reelUrl: "", reason: "", fine: "" };
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  const list = f.campaignId ? membersOf(f.campaignId, members, lookup) : [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setError("");
    setDone("");
    const fine = f.fine.trim() ? Number(f.fine) : null;
    if (fine !== null && !(fine > 0)) {
      setErrors({ fine: "Enter a positive amount, or leave it empty" });
      return;
    }
    const who = lookup.get(f.clipperId)?.name ?? "the clipper";
    if (fine && !window.confirm(`Send this rejection with a fine of ${formatINR(Math.round(fine * 100))} to ${who}?`)) return;
    setBusy(true);
    try {
      await api("/api/admin/rejections", {
        method: "POST",
        json: { campaignId: f.campaignId, clipperId: f.clipperId, reelUrl: f.reelUrl, reason: f.reason, fine },
      });
      setDone(`Rejection sent to ${who}${fine ? ` with a ${formatINR(Math.round(fine * 100))} fine` : ""}.`);
      setF({ ...empty, campaignId: f.campaignId });
      onSent();
    } catch (err) {
      const e2 = err as ApiError;
      setErrors(e2.fields ?? {});
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 md:grid-cols-2" noValidate>
      <Field id="rj-campaign" title="Campaign" error={errors.campaignId}>
        <select
          id="rj-campaign"
          required
          className={field}
          value={f.campaignId}
          onChange={(e) => setF({ ...f, campaignId: e.target.value, clipperId: "" })}
        >
          <option value="">Choose a campaign…</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.status !== "active" ? ` (${c.status})` : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field
        id="rj-clipper"
        title="Clipper"
        error={errors.clipperId}
        hint={f.campaignId && !list.length ? "No active clippers in this campaign yet." : undefined}
      >
        <select
          id="rj-clipper"
          required
          className={field}
          disabled={!f.campaignId || !list.length}
          value={f.clipperId}
          onChange={(e) => setF({ ...f, clipperId: e.target.value })}
        >
          <option value="">{f.campaignId ? "Choose a clipper…" : "Pick a campaign first"}</option>
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              {clipperLabel(c)}
            </option>
          ))}
        </select>
      </Field>
      <div className="md:col-span-2">
        <Field id="rj-reel" title="Reel link" error={errors.reelUrl}>
          <input
            id="rj-reel"
            type="url"
            inputMode="url"
            required
            placeholder="https://www.instagram.com/reel/…"
            className={field}
            value={f.reelUrl}
            onChange={(e) => setF({ ...f, reelUrl: e.target.value })}
          />
        </Field>
      </div>
      <div className="md:col-span-2">
        <Field id="rj-reason" title="Why was it rejected?" error={errors.reason} hint={`${f.reason.length}/1000 — the clipper sees this exactly as written.`}>
          <textarea
            id="rj-reason"
            required
            rows={4}
            maxLength={1000}
            placeholder="e.g. Brand logo cropped out, missing the campaign hashtag…"
            className={cn(field, "resize-y")}
            value={f.reason}
            onChange={(e) => setF({ ...f, reason: e.target.value })}
          />
        </Field>
      </div>
      {canFine && (
        <Field id="rj-fine" title="Fine (optional, ₹)" error={errors.fine} hint="Leave empty for no fine.">
          <input
            id="rj-fine"
            type="number"
            inputMode="decimal"
            min={1}
            max={100000}
            step="0.01"
            placeholder="0"
            className={field}
            value={f.fine}
            onChange={(e) => setF({ ...f, fine: e.target.value })}
          />
        </Field>
      )}
      <div className="flex flex-col gap-3 md:col-span-2">
        <ErrorNote>{error}</ErrorNote>
        <SuccessNote text={done} />
        <div>
          <Button type="submit" size="sm" disabled={busy || !f.campaignId || !f.clipperId}>
            {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />} Send rejection
          </Button>
        </div>
      </div>
    </form>
  );
}

function FineForm({ campaigns, members, clippers, onSent }: Omit<Props, "modes" | "isSuper"> & { onSent: () => void }) {
  const lookup = useClipperLookup(clippers);
  const empty = { campaignId: "", clipperId: "", amount: "", reason: "", reelRef: "" };
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  const list = f.campaignId ? membersOf(f.campaignId, members, lookup) : clippers;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setError("");
    setDone("");
    const amount = Number(f.amount);
    if (!f.amount.trim() || !(amount > 0)) {
      setErrors({ amount: "Enter the fine in ₹" });
      return;
    }
    const who = lookup.get(f.clipperId)?.name ?? "the clipper";
    if (!window.confirm(`Fine ${who} ${formatINR(Math.round(amount * 100))}? They'll be notified right away.`)) return;
    setBusy(true);
    try {
      await api("/api/admin/fines", {
        method: "POST",
        json: { clipperId: f.clipperId, campaignId: f.campaignId || null, amount, reason: f.reason, reelRef: f.reelRef || null },
      });
      setDone(`Fine of ${formatINR(Math.round(amount * 100))} added for ${who}.`);
      setF({ ...empty, campaignId: f.campaignId });
      onSent();
    } catch (err) {
      const e2 = err as ApiError;
      setErrors(e2.fields ?? {});
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 md:grid-cols-2" noValidate>
      <Field id="fn-campaign" title="Campaign (optional)" error={errors.campaignId}>
        <select
          id="fn-campaign"
          className={field}
          value={f.campaignId}
          onChange={(e) => setF({ ...f, campaignId: e.target.value, clipperId: "" })}
        >
          <option value="">No campaign — general fine</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.status !== "active" ? ` (${c.status})` : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field id="fn-clipper" title="Clipper" error={errors.clipperId} hint={!list.length ? "No active clippers here yet." : undefined}>
        <select
          id="fn-clipper"
          required
          className={field}
          disabled={!list.length}
          value={f.clipperId}
          onChange={(e) => setF({ ...f, clipperId: e.target.value })}
        >
          <option value="">Choose a clipper…</option>
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              {clipperLabel(c)}
            </option>
          ))}
        </select>
      </Field>
      <Field id="fn-amount" title="Amount (₹)" error={errors.amount}>
        <input
          id="fn-amount"
          type="number"
          inputMode="decimal"
          required
          min={1}
          max={100000}
          step="0.01"
          placeholder="500"
          className={field}
          value={f.amount}
          onChange={(e) => setF({ ...f, amount: e.target.value })}
        />
      </Field>
      <Field id="fn-ref" title="Reel or reference (optional)" error={errors.reelRef}>
        <input
          id="fn-ref"
          placeholder="Link or short description"
          maxLength={500}
          className={field}
          value={f.reelRef}
          onChange={(e) => setF({ ...f, reelRef: e.target.value })}
        />
      </Field>
      <div className="md:col-span-2">
        <Field id="fn-reason" title="Reason" error={errors.reason} hint={`${f.reason.length}/1000`}>
          <textarea
            id="fn-reason"
            required
            rows={3}
            maxLength={1000}
            placeholder="e.g. Reposted another clipper's edit"
            className={cn(field, "resize-y")}
            value={f.reason}
            onChange={(e) => setF({ ...f, reason: e.target.value })}
          />
        </Field>
      </div>
      <div className="flex flex-col gap-3 md:col-span-2">
        <ErrorNote>{error}</ErrorNote>
        <SuccessNote text={done} />
        <div>
          <Button type="submit" size="sm" disabled={busy || !f.clipperId}>
            {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Gavel size={16} />} Add fine
          </Button>
        </div>
      </div>
    </form>
  );
}

function AnnounceForm({ campaigns, members, clippers, onSent }: Omit<Props, "modes" | "isSuper"> & { onSent: () => void }) {
  const lookup = useClipperLookup(clippers);
  const empty = { campaignId: "", clipperId: "", title: "", body: "", link: "" };
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  const list = f.campaignId ? membersOf(f.campaignId, members, lookup) : [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setError("");
    setDone("");
    const target = f.clipperId ? lookup.get(f.clipperId)?.name ?? "this clipper" : `all ${list.length} clipper${list.length === 1 ? "" : "s"}`;
    if (!f.clipperId && !window.confirm(`Send this announcement to ${target} in the campaign?`)) return;
    setBusy(true);
    try {
      const res = await api<{ recipients: number }>("/api/admin/announcements", {
        method: "POST",
        json: { campaignId: f.campaignId, clipperId: f.clipperId || null, title: f.title, body: f.body, link: f.link || null },
      });
      setDone(`Announcement sent to ${res.recipients} clipper${res.recipients === 1 ? "" : "s"}.`);
      setF({ ...empty, campaignId: f.campaignId });
      onSent();
    } catch (err) {
      const e2 = err as ApiError;
      setErrors(e2.fields ?? {});
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 md:grid-cols-2" noValidate>
      <Field id="an-campaign" title="Campaign" error={errors.campaignId}>
        <select
          id="an-campaign"
          required
          className={field}
          value={f.campaignId}
          onChange={(e) => setF({ ...f, campaignId: e.target.value, clipperId: "" })}
        >
          <option value="">Choose a campaign…</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.status !== "active" ? ` (${c.status})` : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field
        id="an-clipper"
        title="Send to"
        error={errors.clipperId}
        hint={f.campaignId && !list.length ? "No active clippers in this campaign yet." : undefined}
      >
        <select
          id="an-clipper"
          className={field}
          disabled={!f.campaignId || !list.length}
          value={f.clipperId}
          onChange={(e) => setF({ ...f, clipperId: e.target.value })}
        >
          <option value="">{f.campaignId ? `Everyone in the campaign (${list.length})` : "Pick a campaign first"}</option>
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              Only {clipperLabel(c)}
            </option>
          ))}
        </select>
      </Field>
      <div className="md:col-span-2">
        <Field id="an-title" title="Title" error={errors.title}>
          <input
            id="an-title"
            required
            maxLength={120}
            placeholder="e.g. New brief for week 3 is live"
            className={field}
            value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })}
          />
        </Field>
      </div>
      <div className="md:col-span-2">
        <Field id="an-body" title="Message" error={errors.body} hint={`${f.body.length}/2000`}>
          <textarea
            id="an-body"
            required
            rows={5}
            maxLength={2000}
            placeholder="What should the clippers know?"
            className={cn(field, "resize-y")}
            value={f.body}
            onChange={(e) => setF({ ...f, body: e.target.value })}
          />
        </Field>
      </div>
      <div className="md:col-span-2">
        <Field id="an-link" title="Link (optional)" error={errors.link} hint="A brief, Drive folder or reference reel.">
          <input
            id="an-link"
            type="url"
            inputMode="url"
            placeholder="https://…"
            className={field}
            value={f.link}
            onChange={(e) => setF({ ...f, link: e.target.value })}
          />
        </Field>
      </div>
      <div className="flex flex-col gap-3 md:col-span-2">
        <ErrorNote>{error}</ErrorNote>
        <SuccessNote text={done} />
        <div>
          <Button type="submit" size="sm" disabled={busy || !f.campaignId || !list.length}>
            {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Megaphone size={16} />} Send announcement
          </Button>
        </div>
      </div>
    </form>
  );
}

/* ───────────────────────── history ───────────────────────── */

type NoticeItem = {
  id: string;
  kind: "reel_rejected" | "fine" | "info";
  title: string;
  body: string | null;
  reelRef: string | null;
  campaignId: string | null;
  campaignName: string | null;
  clipperId: string;
  clipperName: string;
  recipients: number;
  readCount: number;
  createdAt: string;
  createdByName: string;
};

type FineItem = {
  id: string;
  clipperId: string;
  clipperName: string;
  clipperLogin: string;
  campaignId: string | null;
  campaignName: string | null;
  amountPaise: number;
  reason: string;
  reelRef: string | null;
  createdAt: string;
  createdByName: string;
  waivedAt: string | null;
  waivedByName: string | null;
};

const KIND_PILL: Record<NoticeItem["kind"], { tone: "red" | "amber" | "cyan"; text: string }> = {
  reel_rejected: { tone: "red", text: "Rejected" },
  fine: { tone: "amber", text: "Fine" },
  info: { tone: "cyan", text: "Announcement" },
};

function RefLink({ value, labelText = "Open reel" }: { value: string | null; labelText?: string }) {
  if (!value) return null;
  if (isHttp(value))
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex max-w-full items-center gap-1 break-all text-xs text-lime underline-offset-4 hover:underline"
      >
        <ExternalLink size={12} className="shrink-0" /> {labelText}
      </a>
    );
  return <span className="break-words text-xs text-muted-dark">{value}</span>;
}

function WaiveControl({ fine, onDone }: { fine: FineItem; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function waive() {
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/fines/${fine.id}/waive`, { method: "POST", json: { note: note || null } });
      setOpen(false);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't waive the fine.");
    } finally {
      setBusy(false);
    }
  }

  if (!open)
    return (
      <button type="button" className={smallBtn} onClick={() => setOpen(true)}>
        <Undo2 size={13} /> Waive
      </button>
    );
  return (
    <div className="w-64 space-y-2 rounded-2xl border border-line bg-ink p-3">
      <p className="text-xs text-cream">
        Waive {formatINR(fine.amountPaise)} for {fine.clipperName}? They&apos;ll be told it won&apos;t be deducted.
      </p>
      <label htmlFor={`waive-${fine.id}`} className="sr-only">
        Note for the clipper
      </label>
      <input
        id={`waive-${fine.id}`}
        autoFocus
        maxLength={500}
        placeholder="Note (optional)"
        className={cn(field, "py-2 text-xs")}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter") {
            e.preventDefault();
            void waive();
          }
        }}
      />
      <ErrorNote>{error}</ErrorNote>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={waive}
          className="inline-flex items-center gap-1.5 rounded-full bg-lime px-3 py-1.5 text-xs font-bold text-ink disabled:opacity-60"
        >
          {busy && <LoaderCircle size={12} className="animate-spin" />} Confirm waive
        </button>
        <button type="button" className={smallBtn} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function History({ isSuper, campaigns, clippers, reloadKey }: { isSuper: boolean; campaigns: CampaignOpt[]; clippers: ClipperOpt[]; reloadKey: number }) {
  const [tab, setTab] = useState<"notices" | "fines">("notices");
  const [campaign, setCampaign] = useState("");
  const [clipper, setClipper] = useState("");
  const [type, setType] = useState("");
  const [fineStatus, setFineStatus] = useState("");
  const [notices, setNotices] = useState<NoticeItem[] | null>(null);
  const [fines, setFines] = useState<FineItem[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const qs = new URLSearchParams();
    if (campaign) qs.set("campaign", campaign);
    if (clipper) qs.set("clipper", clipper);
    try {
      if (tab === "notices") {
        if (type) qs.set("type", type);
        const res = await api<{ items: NoticeItem[] }>(`/api/admin/rejections?${qs}`);
        setNotices(res.items);
      } else {
        if (fineStatus) qs.set("status", fineStatus);
        const res = await api<{ fines: FineItem[] }>(`/api/admin/fines?${qs}`);
        setFines(res.fines);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the history.");
    } finally {
      setLoading(false);
    }
  }, [tab, campaign, clipper, type, fineStatus]);

  useEffect(() => {
    void load();
  }, [load, reloadKey, tick]);

  const filtersActive = !!(campaign || clipper || (tab === "notices" ? type : fineStatus));
  const activeTotal = (fines ?? []).filter((f) => !f.waivedAt).reduce((s, f) => s + f.amountPaise, 0);

  return (
    <section className="space-y-5" aria-labelledby="history-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Label>History</Label>
          <h2 id="history-title" className="mt-2 font-display text-2xl font-bold uppercase">
            What&apos;s been sent
          </h2>
        </div>
        <div role="tablist" aria-label="History type" className="flex rounded-full border border-line p-1">
          {(["notices", "fines"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm transition",
                tab === t ? "bg-lime font-bold text-ink" : "text-muted-dark hover:text-cream",
              )}
            >
              {t === "notices" ? "Notices" : "Fines"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="h-campaign" className="sr-only">
            Filter by campaign
          </label>
          <select id="h-campaign" className={field} value={campaign} onChange={(e) => setCampaign(e.target.value)}>
            <option value="">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="h-clipper" className="sr-only">
            Filter by clipper
          </label>
          <select id="h-clipper" className={field} value={clipper} onChange={(e) => setClipper(e.target.value)}>
            <option value="">All clippers</option>
            {clippers.map((c) => (
              <option key={c.id} value={c.id}>
                {clipperLabel(c)}
              </option>
            ))}
          </select>
        </div>
        {tab === "notices" ? (
          <div>
            <label htmlFor="h-type" className="sr-only">
              Filter by type
            </label>
            <select id="h-type" className={field} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>
              <option value="reel_rejected">Rejections</option>
              <option value="fine">Fine notices</option>
              <option value="info">Announcements</option>
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor="h-status" className="sr-only">
              Filter by status
            </label>
            <select id="h-status" className={field} value={fineStatus} onChange={(e) => setFineStatus(e.target.value)}>
              <option value="">Active & waived</option>
              <option value="active">Active only</option>
              <option value="waived">Waived only</option>
            </select>
          </div>
        )}
        <div className="flex items-center gap-2">
          {filtersActive && (
            <button
              type="button"
              className={smallBtn}
              onClick={() => {
                setCampaign("");
                setClipper("");
                setType("");
                setFineStatus("");
              }}
            >
              Clear filters
            </button>
          )}
          <button type="button" className={smallBtn} onClick={() => setTick((n) => n + 1)} disabled={loading} aria-label="Refresh history">
            <RotateCcw size={13} className={cn(loading && "animate-spin")} /> Refresh
          </button>
        </div>
      </div>

      <ErrorNote>{error}</ErrorNote>

      {tab === "notices" ? (
        notices === null ? (
          <p className="text-sm text-muted-dark">Loading…</p>
        ) : !notices.length ? (
          <EmptyState title={filtersActive ? "Nothing matches." : "Nothing sent yet."}>
            {filtersActive ? "Try clearing a filter." : "Rejections, fine notices and announcements you send will show up here."}
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {notices.map((n) => (
              <li key={n.id} className="rounded-3xl border border-line bg-ink-2 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={KIND_PILL[n.kind].tone}>{KIND_PILL[n.kind].text}</Pill>
                  {n.campaignName && <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-dark">{n.campaignName}</span>}
                  <span className="ml-auto font-mono text-[11px] text-muted-dark">{formatDate(n.createdAt)}</span>
                </div>
                <p className="mt-3 font-medium text-cream">{n.title}</p>
                <p className="mt-1 text-sm text-muted-dark">
                  To{" "}
                  <span className="text-cream">
                    {n.recipients > 1 ? `${n.recipients} clippers` : n.clipperName}
                  </span>{" "}
                  · by {n.createdByName} ·{" "}
                  {n.recipients > 1 ? `${n.readCount}/${n.recipients} read` : n.readCount ? "Read" : "Unread"}
                </p>
                {n.body && <p className="mt-3 whitespace-pre-line break-words text-sm text-cream/80">{n.body}</p>}
                {n.reelRef && (
                  <div className="mt-3">
                    <RefLink value={n.reelRef} labelText={n.kind === "info" ? "Open link" : "Open reel"} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )
      ) : fines === null ? (
        <p className="text-sm text-muted-dark">Loading…</p>
      ) : !fines.length ? (
        <EmptyState title={filtersActive ? "Nothing matches." : "No fines yet."}>
          {filtersActive ? "Try clearing a filter." : "Fines you add — with a rejection or on their own — will show up here."}
        </EmptyState>
      ) : (
        <>
          <p className="text-sm text-muted-dark">
            {fines.length} fine{fines.length === 1 ? "" : "s"} shown · active total <span className="text-cream">{formatINR(activeTotal)}</span>
          </p>
          <TableWrap minWidth={860}>
            <thead>
              <tr className={tr}>
                <th className={th}>Clipper</th>
                <th className={th}>Amount</th>
                <th className={th}>Reason</th>
                <th className={th}>Added</th>
                <th className={th}>Status</th>
                {isSuper && <th className={th}>
                  <span className="sr-only">Actions</span>
                </th>}
              </tr>
            </thead>
            <tbody>
              {fines.map((f) => (
                <tr key={f.id} className={tr}>
                  <td className={td}>
                    <p className="text-cream">{f.clipperName}</p>
                    <p className="font-mono text-[11px] text-muted-dark">@{f.clipperLogin}</p>
                    <p className="mt-1 text-xs text-muted-dark">{f.campaignName ?? "No campaign"}</p>
                  </td>
                  <td className={cn(td, "whitespace-nowrap font-mono", f.waivedAt ? "text-muted-dark line-through" : "text-cream")}>
                    {formatINR(f.amountPaise)}
                  </td>
                  <td className={cn(td, "max-w-[280px]")}>
                    <p className="whitespace-pre-line break-words text-cream/85">{f.reason}</p>
                    {f.reelRef && (
                      <div className="mt-1">
                        <RefLink value={f.reelRef} />
                      </div>
                    )}
                  </td>
                  <td className={cn(td, "whitespace-nowrap text-muted-dark")}>
                    {formatDate(f.createdAt)}
                    <p className="text-xs">by {f.createdByName}</p>
                  </td>
                  <td className={td}>
                    {f.waivedAt ? (
                      <>
                        <Pill tone="grey">Waived</Pill>
                        <p className="mt-1 text-xs text-muted-dark">
                          {formatDate(f.waivedAt)}
                          {f.waivedByName ? ` · ${f.waivedByName}` : ""}
                        </p>
                      </>
                    ) : (
                      <Pill tone="amber">Active</Pill>
                    )}
                  </td>
                  {isSuper && (
                    <td className={cn(td, "text-right")}>{!f.waivedAt && <WaiveControl fine={f} onDone={() => setTick((n) => n + 1)} />}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </>
      )}
    </section>
  );
}

/* ───────────────────────── page body ───────────────────────── */

export function NoticesManager({ modes, isSuper, campaigns, members, clippers }: Props) {
  const available = (Object.keys(MODE_META) as Mode[]).filter((m) => modes[m]);
  const [mode, setMode] = useState<Mode>(available[0] ?? "reject");
  const [reloadKey, setReloadKey] = useState(0);
  const onSent = () => setReloadKey((n) => n + 1);

  const noCampaigns = !campaigns.length;
  const MetaIcon = MODE_META[mode].icon;

  return (
    <div className="space-y-12">
      <Card>
        {available.length > 1 && (
          <div role="tablist" aria-label="What do you want to send?" className="mb-6 flex flex-wrap gap-2">
            {available.map((m) => {
              const Icon = MODE_META[m].icon;
              return (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
                    mode === m ? "border-lime bg-lime font-bold text-ink" : "border-line text-muted-dark hover:border-lime hover:text-lime",
                  )}
                >
                  <Icon size={15} /> {MODE_META[m].label}
                </button>
              );
            })}
          </div>
        )}
        <div className="mb-6 flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-lime/15 text-lime">
            <MetaIcon size={18} />
          </span>
          <div>
            <h2 className="font-display text-xl font-bold uppercase">{MODE_META[mode].label}</h2>
            <p className="text-sm text-muted-dark">{MODE_META[mode].hint}</p>
          </div>
        </div>

        {noCampaigns && mode !== "fine" ? (
          <EmptyState title="No campaigns yet.">
            You need to be assigned to a campaign before you can send {mode === "reject" ? "rejections" : "announcements"}.
          </EmptyState>
        ) : mode === "reject" ? (
          <RejectForm campaigns={campaigns} members={members} clippers={clippers} canFine={modes.fine} onSent={onSent} />
        ) : mode === "fine" ? (
          <FineForm campaigns={campaigns} members={members} clippers={clippers} onSent={onSent} />
        ) : (
          <AnnounceForm campaigns={campaigns} members={members} clippers={clippers} onSent={onSent} />
        )}
      </Card>

      <History isSuper={isSuper} campaigns={campaigns} clippers={clippers} reloadKey={reloadKey} />
    </div>
  );
}
