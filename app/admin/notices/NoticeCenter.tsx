"use client";

import { Check, Copy, LoaderCircle, MessageCircle, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { api, type ApiError } from "@/lib/portal/client";
import { formatDate } from "@/lib/portal/weeks";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, ErrorNote, Label, TableWrap, errorText, field, label, smallBtn, td, th, tr } from "@/components/portal/ui";
import type { CampaignOpt, ClipperOpt } from "../rejections/types";

export type NoticeRow = {
  batch_id: string;
  title: string;
  body: string;
  link: string | null;
  sent_at: string;
  sender: string | null;
  audience: string;
  recipients: number;
  read_count: number;
};

const PORTAL = "https://clipcrew.ignitralabs.com/login";

function shareText(n: { title: string; body: string; link?: string | null }) {
  return [`*${n.title}*`, n.body, n.link ? n.link : null, "", `Open your ClipCrew portal: ${PORTAL}`].filter((x) => x !== null).join("\n");
}
const whatsapp = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

type Audience = "campaigns" | "clippers" | "everyone";

export function NoticeCenter({ campaigns, members, clippers, history, isSuper }: { campaigns: CampaignOpt[]; members: Record<string, string[]>; clippers: ClipperOpt[]; history: NoticeRow[]; isSuper: boolean }) {
  const router = useRouter();
  const [audience, setAudience] = useState<Audience>("campaigns");
  const [picked, setPicked] = useState<Set<string>>(new Set()); // campaign ids or clipper ids, depending on audience
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<{ recipients: number; text: string } | null>(null);
  const [copied, setCopied] = useState("");

  const recipientCount = useMemo(() => {
    if (audience === "everyone") return clippers.length;
    if (audience === "clippers") return picked.size;
    const ids = new Set<string>();
    picked.forEach((c) => (members[c] ?? []).forEach((id) => ids.add(id)));
    return ids.size;
  }, [audience, picked, members, clippers.length]);

  const visibleClippers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? clippers.filter((c) => c.name.toLowerCase().includes(q) || c.loginId.toLowerCase().includes(q)) : clippers;
  }, [clippers, search]);

  function pickAudience(a: Audience) {
    setAudience(a);
    setPicked(new Set());
    setErrors({});
  }
  function toggle(id: string) {
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setSent(null);
    const aud =
      audience === "everyone" ? { type: "everyone" } : audience === "campaigns" ? { type: "campaigns", campaignIds: Array.from(picked) } : { type: "clippers", clipperIds: Array.from(picked) };
    setSaving(true);
    try {
      const r = await api<{ recipients: number }>("/api/admin/notices", { method: "POST", json: { audience: aud, title, body, link: link.trim() || "" } });
      setSent({ recipients: r.recipients, text: shareText({ title, body, link: link.trim() || null }) });
      setTitle("");
      setBody("");
      setLink("");
      setPicked(new Set());
      router.refresh();
    } catch (err) {
      const e2 = err as ApiError;
      setErrors({ ...(e2.fields ?? {}), form: e2.message });
    } finally {
      setSaving(false);
    }
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      /* clipboard blocked: the WhatsApp button still works */
    }
  }

  const audiences: { key: Audience; label: string; show: boolean }[] = [
    { key: "campaigns", label: "Campaigns", show: true },
    { key: "clippers", label: "Selected clippers", show: true },
    { key: "everyone", label: "Everyone", show: isSuper },
  ];

  return (
    <div className="space-y-10">
      <Card>
        <Label>Send a notice</Label>
        <form onSubmit={send} className="mt-4 space-y-5" noValidate>
          <fieldset>
            <legend className={label}>Who gets it?</legend>
            <div className="flex flex-wrap gap-2">
              {audiences.filter((a) => a.show).map((a) => (
                <button
                  key={a.key}
                  type="button"
                  aria-pressed={audience === a.key}
                  onClick={() => pickAudience(a.key)}
                  className={cn("rounded-full border px-4 py-2 text-sm transition", audience === a.key ? "border-lime bg-lime font-bold text-ink" : "border-line text-muted-dark hover:border-lime hover:text-lime")}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </fieldset>

          {audience === "campaigns" && (
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-2xl border border-line bg-ink p-3">
              {campaigns.length === 0 && <p className="text-sm text-muted-dark">No campaigns yet.</p>}
              {campaigns.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-ink-2">
                  <input type="checkbox" className="h-4 w-4 accent-[#C8F04A]" checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
                  <span className="flex-1">{c.name}</span>
                  <span className="font-mono text-xs text-muted-dark">{(members[c.id] ?? []).length} clipper{(members[c.id] ?? []).length === 1 ? "" : "s"}</span>
                </label>
              ))}
            </div>
          )}
          {audience === "clippers" && (
            <div className="space-y-2">
              <input className={field} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clippers by name or login ID" aria-label="Search clippers" />
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-2xl border border-line bg-ink p-3">
                {visibleClippers.length === 0 && <p className="text-sm text-muted-dark">No clippers match.</p>}
                {visibleClippers.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-ink-2">
                    <input type="checkbox" className="h-4 w-4 accent-[#C8F04A]" checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
                    <span className="flex-1">{c.name}</span>
                    <span className="font-mono text-xs text-muted-dark">{c.loginId}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <p className="text-sm text-muted-dark">
            {audience === "everyone" ? "Every active clipper" : "Reaches"} <span className="font-mono text-lime">{recipientCount}</span> clipper{recipientCount === 1 ? "" : "s"}.
          </p>

          <div>
            <label htmlFor="n-title" className={label}>Title</label>
            <input id="n-title" className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. New brief for this week" />
            {errors.title && <p className={errorText}>{errors.title}</p>}
          </div>
          <div>
            <label htmlFor="n-body" className={label}>Message</label>
            <textarea id="n-body" className={field} rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
            {errors.body && <p className={errorText}>{errors.body}</p>}
          </div>
          <div>
            <label htmlFor="n-link" className={label}>Link <span className="text-muted-dark">(optional)</span></label>
            <input id="n-link" className={field} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" inputMode="url" />
            {errors.link && <p className={errorText}>{errors.link}</p>}
          </div>

          {errors.form && !errors.title && !errors.body && !errors.link && <ErrorNote>{errors.form}</ErrorNote>}
          {recipientCount === 0 && <p className="text-xs text-[#f5c451]">Pick who should get this.</p>}
          <Button type="submit" size="sm" disabled={saving || recipientCount === 0 || !title.trim() || !body.trim()}>
            {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />} Send notice
          </Button>
        </form>

        {sent && (
          <div className="mt-6 rounded-2xl border border-lime bg-lime/10 p-4" role="status">
            <p className="flex items-center gap-2 text-sm text-lime"><Check size={16} /> Sent to {sent.recipients} clipper{sent.recipients === 1 ? "" : "s"}. They see it in their inbox.</p>
            <p className="mt-2 text-xs text-muted-dark">Want to nudge them outside the portal too?</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={whatsapp(sent.text)} target="_blank" rel="noopener noreferrer" className={`${smallBtn} border-lime/60 text-lime`}>
                <MessageCircle size={13} /> Share on WhatsApp
              </a>
              <button type="button" className={smallBtn} onClick={() => copy(sent.text, "new")}>
                {copied === "new" ? <Check size={13} /> : <Copy size={13} />} Copy text
              </button>
            </div>
          </div>
        )}
      </Card>

      <section aria-labelledby="hist-h" className="space-y-4">
        <h2 id="hist-h" className="font-display text-2xl font-bold uppercase">Recent notices</h2>
        {history.length === 0 ? (
          <EmptyState title="No notices sent yet">Notices you send show up here with how many people read them.</EmptyState>
        ) : (
          <TableWrap minWidth={820}>
            <thead>
              <tr className={tr}>
                <th className={th}>Notice</th>
                <th className={th}>To</th>
                <th className={th}>Sent</th>
                <th className={th}>Read</th>
                <th className={th}><span className="sr-only">Share</span></th>
              </tr>
            </thead>
            <tbody>
              {history.map((n) => {
                const pct = n.recipients ? Math.round((n.read_count / n.recipients) * 100) : 0;
                const text = shareText({ title: n.title, body: n.body, link: n.link });
                return (
                  <tr key={n.batch_id} className={tr}>
                    <td className={td}>
                      <p className="font-medium">{n.title}</p>
                      <p className="mt-1 line-clamp-2 max-w-[360px] text-xs text-muted-dark">{n.body}</p>
                    </td>
                    <td className={td}>
                      <p>{n.audience}</p>
                      <p className="text-xs text-muted-dark">{n.recipients} clipper{n.recipients === 1 ? "" : "s"}</p>
                    </td>
                    <td className={`${td} whitespace-nowrap text-xs text-muted-dark`}>
                      {formatDate(n.sent_at)}
                      {n.sender && <p>{n.sender}</p>}
                    </td>
                    <td className={td}>
                      <p className="font-mono text-sm">{n.read_count}/{n.recipients} <span className="text-muted-dark">({pct}%)</span></p>
                      <div className="mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-line" aria-hidden>
                        <div className="h-full rounded-full bg-lime" style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td className={`${td} text-right`}>
                      <div className="flex flex-wrap justify-end gap-2">
                        <a href={whatsapp(text)} target="_blank" rel="noopener noreferrer" className={smallBtn}><MessageCircle size={13} /> WhatsApp</a>
                        <button type="button" className={smallBtn} onClick={() => copy(text, n.batch_id)}>
                          {copied === n.batch_id ? <Check size={13} /> : <Copy size={13} />} Copy
                        </button>
                      </div>
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
