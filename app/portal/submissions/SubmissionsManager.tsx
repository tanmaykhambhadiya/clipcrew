"use client";

import { ExternalLink, LoaderCircle, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { api, type ApiError } from "@/lib/portal/client";
import { formatDate } from "@/lib/portal/weeks";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, ErrorNote, Label, PLATFORM_LABELS, Pill, TableWrap, errorText, field, label, smallBtn, td, th, tr } from "@/components/portal/ui";

export type SubmitOption = { id: string; name: string; accounts: { id: string; platform: string; username: string }[] };
export type SubmissionRow = {
  id: string;
  url: string;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  reject_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  campaign_id: string;
  campaign_name: string;
  platform: string;
  username: string;
};

const TONE = { pending: "amber", approved: "lime", rejected: "red" } as const;
const URL_HINT: Record<string, string> = {
  instagram: "instagram.com/reel/…",
  youtube: "youtube.com/shorts/… or youtu.be/…",
  tiktok: "tiktok.com/@you/video/…",
  facebook: "facebook.com/reel/…",
  x: "x.com/you/status/…",
  other: "the link to your post",
};

/** Only real web links become clickable. */
const safeUrl = (v: string) => (/^https?:\/\//i.test(v) ? v : null);

export function SubmissionsManager({ submissions, options }: { submissions: SubmissionRow[]; options: SubmitOption[] }) {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState(options[0]?.id ?? "");
  const accounts = useMemo(() => options.find((o) => o.id === campaignId)?.accounts ?? [], [options, campaignId]);
  const [accountId, setAccountId] = useState(options[0]?.accounts[0]?.id ?? "");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState("");

  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];
  const shown = filter === "all" ? submissions : submissions.filter((s) => s.status === filter);
  const counts = { pending: submissions.filter((s) => s.status === "pending").length, approved: submissions.filter((s) => s.status === "approved").length, rejected: submissions.filter((s) => s.status === "rejected").length };

  function pickCampaign(id: string) {
    setCampaignId(id);
    setAccountId(options.find((o) => o.id === id)?.accounts[0]?.id ?? "");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setDone("");
    try {
      await api("/api/portal/submissions", { method: "POST", json: { campaignId, accountId: account?.id, url, note: note || undefined } });
      setUrl("");
      setNote("");
      setDone("Submitted — we'll review it soon.");
      router.refresh();
    } catch (err) {
      const e2 = err as ApiError;
      setErrors({ ...(e2.fields ?? {}), form: e2.message });
    } finally {
      setSaving(false);
    }
  }

  async function withdraw(s: SubmissionRow) {
    if (!window.confirm("Withdraw this submission?")) return;
    setBusyId(s.id);
    setRowError("");
    try {
      await api(`/api/portal/submissions/${s.id}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Couldn't withdraw it.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      {options.length === 0 ? (
        <EmptyState title="You can't submit reels yet">
          To submit, you need a <Link href="/portal/accounts" className="text-lime underline-offset-4 hover:underline">verified account</Link> that counts in an active{" "}
          <Link href="/portal/campaigns" className="text-lime underline-offset-4 hover:underline">campaign</Link>.
        </EmptyState>
      ) : (
        <Card>
          <Label>Submit a reel</Label>
          <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="s-campaign" className={label}>Campaign</label>
                <select id="s-campaign" className={field} value={campaignId} onChange={(e) => pickCampaign(e.target.value)}>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="s-account" className={label}>Posted from</label>
                <select id="s-account" className={field} value={account?.id ?? ""} onChange={(e) => setAccountId(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{PLATFORM_LABELS[a.platform] ?? a.platform} · @{a.username}</option>
                  ))}
                </select>
                {errors.accountId && <p className={errorText}>{errors.accountId}</p>}
              </div>
            </div>
            <div>
              <label htmlFor="s-url" className={label}>Reel link</label>
              <input
                id="s-url"
                className={field}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={`Paste ${URL_HINT[account?.platform ?? "other"]}`}
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
              />
              {errors.url && <p className={errorText}>{errors.url}</p>}
            </div>
            <div>
              <label htmlFor="s-note" className={label}>Note <span className="text-muted-dark">(optional)</span></label>
              <input id="s-note" className={field} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="e.g. the hot-take clip, part 2" />
            </div>
            {errors.form && !errors.url && !errors.accountId && <ErrorNote>{errors.form}</ErrorNote>}
            {done && <p className="text-sm text-lime" role="status">{done}</p>}
            <Button type="submit" size="sm" disabled={saving || !url.trim()}>
              {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />} Submit reel
            </Button>
          </form>
        </Card>
      )}

      <section aria-label="Your submissions" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "pending", "approved", "rejected"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition",
                filter === f ? "border-lime bg-lime font-bold text-ink" : "border-line text-muted-dark hover:border-lime hover:text-lime",
              )}
            >
              {f === "all" ? `All ${submissions.length}` : `${f[0].toUpperCase() + f.slice(1)} ${counts[f]}`}
            </button>
          ))}
        </div>
        <ErrorNote>{rowError}</ErrorNote>
        {shown.length === 0 ? (
          <EmptyState title={submissions.length ? "Nothing here" : "No submissions yet"}>
            {submissions.length ? "Try another filter." : "Your submitted reels show up here with their review status."}
          </EmptyState>
        ) : (
          <TableWrap minWidth={760}>
            <thead>
              <tr className={tr}>
                <th className={th}>Reel</th>
                <th className={th}>Campaign</th>
                <th className={th}>Status</th>
                <th className={th}>Submitted</th>
                <th className={th}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => {
                const link = safeUrl(s.url);
                return (
                  <tr key={s.id} className={tr}>
                    <td className={td}>
                      {link ? (
                        <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-[260px] items-center gap-1 break-all text-lime underline-offset-4 hover:underline">
                          <span className="truncate">{s.url.replace(/^https?:\/\/(www\.)?/, "")}</span> <ExternalLink size={12} aria-hidden />
                        </a>
                      ) : (
                        <span className="break-all text-xs">{s.url}</span>
                      )}
                      <p className="mt-1 text-xs text-muted-dark">{PLATFORM_LABELS[s.platform] ?? s.platform} · @{s.username}</p>
                      {s.note && <p className="mt-1 text-xs text-muted-dark">“{s.note}”</p>}
                    </td>
                    <td className={td}>{s.campaign_name}</td>
                    <td className={td}>
                      <Pill tone={TONE[s.status]}>{s.status}</Pill>
                      {s.status === "rejected" && s.reject_reason && <p className="mt-1 max-w-[220px] text-xs text-[#ff8a7a]">{s.reject_reason}</p>}
                    </td>
                    <td className={`${td} whitespace-nowrap text-xs text-muted-dark`}>{formatDate(s.created_at)}</td>
                    <td className={`${td} text-right`}>
                      {s.status === "pending" && (
                        <button type="button" className={smallBtn} onClick={() => withdraw(s)} disabled={busyId === s.id} aria-label="Withdraw this submission">
                          {busyId === s.id ? <LoaderCircle size={13} className="animate-spin" /> : <Trash2 size={13} />} Withdraw
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </section>
    </div>
  );
}
