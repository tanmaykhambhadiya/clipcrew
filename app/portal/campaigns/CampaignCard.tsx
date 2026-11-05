"use client";

import { Lock, LoaderCircle, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { api } from "@/lib/portal/client";
import { formatINR, formatViews } from "@/lib/portal/money";
import { formatDate } from "@/lib/portal/weeks";
import { Button } from "@/components/ui/Button";
import { Card, ErrorNote, Label, PLATFORM_LABELS, Pill } from "@/components/portal/ui";
import type { ClipperCampaign, MyAccount } from "./data";

const STATUS_TONE = { active: "lime", paused: "amber", ended: "grey", draft: "grey" } as const;

export function CampaignCard({ campaign: c, accounts }: { campaign: ClipperCampaign; accounts: MyAccount[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(c.linkedAccountIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const editable = c.status === "active";
  const locked = useMemo(() => new Set(c.lockedAccountIds), [c.lockedAccountIds]);
  const dirty = selected.length !== c.linkedAccountIds.length || selected.some((id) => !c.linkedAccountIds.includes(id));

  // Show: accounts already linked (whatever their state) + verified accounts on an allowed platform.
  const eligible = accounts.filter(
    (a) => c.linkedAccountIds.includes(a.id) || (a.status === "verified" && c.allowed_platforms.includes(a.platform)),
  );
  const notAllowedVerified = accounts.filter((a) => a.status === "verified" && !c.allowed_platforms.includes(a.platform) && !c.linkedAccountIds.includes(a.id));

  function toggle(id: string, on: boolean) {
    setSaved(false);
    setError("");
    if (!on && locked.has(id)) {
      setError("That account already has views recorded in this campaign, so it can't be removed. Message your admin if it needs to change.");
      return;
    }
    if (on && selected.length >= c.max_accounts_per_clipper) {
      setError(`This campaign allows up to ${c.max_accounts_per_clipper} account${c.max_accounts_per_clipper === 1 ? "" : "s"}. Untick one first.`);
      return;
    }
    setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      await api(`/api/portal/campaigns/${c.id}/accounts`, { method: "PUT", json: { accountIds: selected } });
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {c.client && <Label>{c.client}</Label>}
          <h2 className="mt-1 break-words font-display text-2xl font-bold uppercase leading-tight">{c.name}</h2>
        </div>
        <Pill tone={STATUS_TONE[c.status]}>{c.status}</Pill>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark">Rate</dt>
          <dd className="mt-1">
            <span className="font-semibold text-lime">{formatINR(c.rate_per_million_paise, { decimals: c.rate_per_million_paise % 100 !== 0 })}</span>
            <span className="text-muted-dark"> / 1M views</span>
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark">Dates</dt>
          <dd className="mt-1">
            {c.starts_on || c.ends_on ? `${formatDate(c.starts_on)} → ${c.ends_on ? formatDate(c.ends_on) : "ongoing"}` : "Ongoing"}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark">Your views</dt>
          <dd className="mt-1 font-semibold">{formatViews(c.views)}</dd>
        </div>
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark">You&apos;ve earned</dt>
          <dd className="mt-1 font-semibold text-lime">{formatINR(c.earned_paise)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark">Platforms that count</dt>
          <dd className="mt-2 flex flex-wrap gap-1.5">
            {c.allowed_platforms.length ? c.allowed_platforms.map((p) => <Pill key={p} tone="cyan">{PLATFORM_LABELS[p] ?? p}</Pill>) : <span className="text-muted-dark">None set</span>}
          </dd>
        </div>
      </dl>

      <fieldset className="rounded-2xl border border-line bg-ink p-4">
        <legend className="px-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark">
          Accounts used {selected.length} of {c.max_accounts_per_clipper}
        </legend>

        {eligible.length === 0 ? (
          <p className="text-sm text-muted-dark">
            No verified {c.allowed_platforms.map((p) => PLATFORM_LABELS[p] ?? p).join(" / ")} account yet. Add one on the Accounts page and wait for it to be verified.
          </p>
        ) : (
          <ul className="space-y-2">
            {eligible.map((a) => {
              const checked = selected.includes(a.id);
              const isLocked = locked.has(a.id) && checked;
              return (
                <li key={a.id}>
                  <label
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition",
                      checked ? "border-lime/50 bg-lime/5" : "border-line",
                      editable && !isLocked ? "cursor-pointer hover:border-lime/70" : "cursor-default",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-[#C8F04A]"
                      checked={checked}
                      disabled={!editable || saving}
                      onChange={(e) => toggle(a.id, e.target.checked)}
                      aria-describedby={isLocked ? `lock-${c.id}-${a.id}` : undefined}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="text-muted-dark">{PLATFORM_LABELS[a.platform] ?? a.platform} · </span>
                      <span className="font-mono">@{a.username}</span>
                    </span>
                    {a.status !== "verified" && <Pill tone="red">{a.status}</Pill>}
                    {isLocked && (
                      <span id={`lock-${c.id}-${a.id}`} className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-dark" title="Has views recorded — contact admin to remove">
                        <Lock size={12} aria-hidden /> has views
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {notAllowedVerified.length > 0 && (
          <p className="mt-3 text-xs text-muted-dark">
            {notAllowedVerified.length} of your verified account{notAllowedVerified.length === 1 ? " is" : "s are"} on a platform this campaign doesn&apos;t count.
          </p>
        )}
        {!editable && <p className="mt-3 text-xs text-muted-dark">This campaign is {c.status}, so accounts can&apos;t be changed right now.</p>}
      </fieldset>

      <ErrorNote>{error}</ErrorNote>

      {editable && eligible.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={save} disabled={!dirty || saving}>
            {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />} Save accounts
          </Button>
          {dirty && !saving && (
            <button type="button" className="text-sm text-muted-dark hover:text-cream" onClick={() => setSelected(c.linkedAccountIds)}>
              Undo changes
            </button>
          )}
          {saved && !dirty && <span className="text-sm text-lime">Saved</span>}
        </div>
      )}
    </Card>
  );
}
