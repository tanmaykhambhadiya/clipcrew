"use client";

import Link from "next/link";
import { Check, Copy, LoaderCircle, MessageCircle, Plus, Power, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { api, type ApiError } from "@/lib/portal/client";
import { formatDate } from "@/lib/portal/weeks";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, ErrorNote, Label, Pill, errorText, field, label, smallBtn } from "@/components/portal/ui";

type Campaign = { id: string; name: string; status: string };
type Invite = {
  id: string;
  token: string;
  label: string;
  campaignIds: string[];
  maxUses: number | null;
  uses: number;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
  problem: string | null;
  joined: { id: string; name: string; loginId: string; joinedAt: string }[];
};

const linkFor = (token: string) => `${typeof window === "undefined" ? "" : window.location.origin}/join/${token}`;
const shareText = (token: string) => `Join ClipCrew as a clipper. Sign up here and you're in: ${linkFor(token)}`;

function statusOf(inv: Invite): { text: string; tone: "lime" | "amber" | "grey" } {
  if (!inv.active) return { text: "off", tone: "grey" };
  if (inv.expiresAt && new Date(inv.expiresAt) <= new Date()) return { text: "expired", tone: "amber" };
  if (inv.maxUses !== null && inv.uses >= inv.maxUses) return { text: "used up", tone: "amber" };
  return { text: "live", tone: "lime" };
}

function CopyButton({ text, labelText = "Copy link" }: { text: string; labelText?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={cn(smallBtn, "border-lime/60 text-lime")}
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        })
      }
    >
      {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : labelText}
    </button>
  );
}

function ShareButtons({ token }: { token: string }) {
  return (
    <>
      <CopyButton text={linkFor(token)} />
      <a className={smallBtn} href={`https://wa.me/?text=${encodeURIComponent(shareText(token))}`} target="_blank" rel="noopener noreferrer">
        <MessageCircle size={13} /> Share on WhatsApp
      </a>
    </>
  );
}

export function InvitesManager() {
  const [links, setLinks] = useState<Invite[] | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadError, setLoadError] = useState("");
  const [rowError, setRowError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await api<{ links: Invite[]; campaigns: Campaign[] }>("/api/admin/invites");
      setLinks(d.links);
      setCampaigns(d.campaigns);
      setLoadError("");
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function patch(inv: Invite, json: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(inv.id);
    setRowError("");
    try {
      await api(`/api/admin/invites/${inv.id}`, { method: "PATCH", json });
      await load();
    } catch (e) {
      setRowError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const names = new Map(campaigns.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-8">
      <CreateInvite campaigns={campaigns} onCreated={load} />

      <section aria-labelledby="inv-h" className="space-y-4">
        <h2 id="inv-h" className="font-display text-2xl font-bold uppercase">
          Your links
        </h2>
        <ErrorNote>{loadError || rowError}</ErrorNote>
        {links === null ? (
          !loadError && <p className="text-sm text-muted-dark">Loading…</p>
        ) : !links.length ? (
          <EmptyState title="No invite links yet.">Create one above and share it with your clippers.</EmptyState>
        ) : (
          <ul className="space-y-4">
            {links.map((inv) => {
              const st = statusOf(inv);
              return (
                <li key={inv.id}>
                  <Card>
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-lg font-bold uppercase">{inv.label}</span>
                      <Pill tone={st.tone}>{st.text}</Pill>
                    </p>
                    <p className="mt-1 text-sm text-muted-dark">
                      {inv.uses} joined{inv.maxUses ? ` of ${inv.maxUses}` : ""} · created {formatDate(inv.createdAt)}
                      {inv.expiresAt ? ` · ${new Date(inv.expiresAt) <= new Date() ? "expired" : "expires"} ${formatDate(inv.expiresAt)}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-muted-dark">
                      {inv.campaignIds.length ? (
                        <>
                          Joins: <span className="text-cream">{inv.campaignIds.map((id) => names.get(id) ?? "ended campaign").join(", ")}</span>
                        </>
                      ) : (
                        "Doesn't add them to a campaign"
                      )}
                    </p>

                    <p className="mt-4 break-all rounded-xl border border-line bg-ink px-3.5 py-2.5 font-mono text-sm text-cream">{linkFor(inv.token)}</p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <ShareButtons token={inv.token} />
                      <button
                        type="button"
                        className={smallBtn}
                        disabled={busy === inv.id}
                        onClick={() =>
                          patch(inv, { action: "set_active", active: !inv.active }, inv.active ? `Turn off "${inv.label}"? Nobody new can sign up with it.` : undefined)
                        }
                      >
                        {busy === inv.id ? <LoaderCircle size={13} className="animate-spin" /> : <Power size={13} />} {inv.active ? "Turn off" : "Turn on"}
                      </button>
                      <button
                        type="button"
                        className={smallBtn}
                        disabled={busy === inv.id}
                        onClick={() => patch(inv, { action: "new_token" }, "Replace this link? The old URL stops working right away; share the new one.")}
                      >
                        <RefreshCw size={13} /> New URL
                      </button>
                    </div>

                    {inv.joined.length > 0 && (
                      <details className="mt-4">
                        <summary className="cursor-pointer text-sm text-muted-dark hover:text-cream">
                          Who joined ({inv.joined.length}
                          {inv.uses > inv.joined.length ? "+" : ""})
                        </summary>
                        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                          {inv.joined.map((p) => (
                            <li key={p.id}>
                              <Link href={`/admin/clippers/${p.id}`} className="text-cream underline-offset-4 hover:text-lime hover:underline">
                                {p.name}
                              </Link>
                              <span className="ml-2 font-mono text-xs text-muted-dark">
                                {p.loginId} · {formatDate(p.joinedAt)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function CreateInvite({ campaigns, onCreated }: { campaigns: Campaign[]; onCreated: () => Promise<void> }) {
  const empty = { label: "", campaignIds: [] as string[], maxUses: "", expiresInDays: "" };
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setError("");
    setBusy(true);
    try {
      const r = await api<{ token: string }>("/api/admin/invites", {
        method: "POST",
        json: {
          label: f.label,
          campaignIds: f.campaignIds,
          maxUses: f.maxUses ? Number(f.maxUses) : null,
          expiresInDays: f.expiresInDays ? Number(f.expiresInDays) : null,
        },
      });
      setCreated(r.token);
      setF(empty);
      await onCreated();
    } catch (err) {
      const e2 = err as ApiError;
      setErrors(e2.fields ?? {});
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: string) =>
    setF((cur) => ({ ...cur, campaignIds: cur.campaignIds.includes(id) ? cur.campaignIds.filter((x) => x !== id) : [...cur.campaignIds, id] }));

  return (
    <Card>
      <Label>New invite link</Label>
      <form onSubmit={submit} className="mt-4 grid gap-5 md:grid-cols-2" noValidate>
        <div className="md:col-span-2">
          <label htmlFor="inv-label" className={label}>
            Name (only you see it)
          </label>
          <input
            id="inv-label"
            className={field}
            placeholder="e.g. Instagram batch, November"
            value={f.label}
            maxLength={80}
            onChange={(e) => setF({ ...f, label: e.target.value })}
          />
          {errors.label && <p className={errorText}>{errors.label}</p>}
        </div>
        <fieldset className="md:col-span-2">
          <legend className={label}>Add new clippers to these campaigns (optional)</legend>
          {campaigns.length ? (
            <div className="flex flex-wrap gap-2">
              {campaigns.map((c) => {
                const on = f.campaignIds.includes(c.id);
                return (
                  <button key={c.id} type="button" aria-pressed={on} onClick={() => toggle(c.id)} className={cn(smallBtn, on && "border-lime bg-lime/15 text-lime")}>
                    {on && <Check size={13} />} {c.name}
                    {c.status !== "active" ? ` (${c.status})` : ""}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-dark">No campaigns yet. You can add clippers to campaigns later.</p>
          )}
          {errors.campaignIds && <p className={errorText}>{errors.campaignIds}</p>}
        </fieldset>
        <div>
          <label htmlFor="inv-max" className={label}>
            Max sign-ups (optional)
          </label>
          <input
            id="inv-max"
            type="number"
            inputMode="numeric"
            min={1}
            max={10000}
            className={field}
            placeholder="No limit"
            value={f.maxUses}
            onChange={(e) => setF({ ...f, maxUses: e.target.value })}
          />
          {errors.maxUses && <p className={errorText}>{errors.maxUses}</p>}
        </div>
        <div>
          <label htmlFor="inv-exp" className={label}>
            Expires after (days, optional)
          </label>
          <input
            id="inv-exp"
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            className={field}
            placeholder="Never"
            value={f.expiresInDays}
            onChange={(e) => setF({ ...f, expiresInDays: e.target.value })}
          />
          {errors.expiresInDays && <p className={errorText}>{errors.expiresInDays}</p>}
        </div>
        <div className="flex flex-col gap-3 md:col-span-2">
          <ErrorNote>{Object.keys(errors).length ? "" : error}</ErrorNote>
          <div>
            <Button type="submit" size="sm" disabled={busy || f.label.trim().length < 2}>
              {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />} Create link
            </Button>
          </div>
        </div>
      </form>

      {created && (
        <div className="mt-5 rounded-2xl border border-lime bg-lime/10 p-4" role="status">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-lime">Link ready, share it</p>
          <p className="mt-2 break-all font-mono text-sm">{linkFor(created)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ShareButtons token={created} />
            <button type="button" className={smallBtn} onClick={() => setCreated(null)}>
              Done
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
