"use client";

import { Info, LoaderCircle, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { PLATFORMS, PLATFORM_LABELS, errorText, field, label } from "@/components/portal/ui";
import { api, type ApiError } from "@/lib/portal/client";
import { formatINR, paiseToRupees } from "@/lib/portal/money";

export type CampaignFormValues = {
  id?: string;
  name: string;
  client: string | null;
  ratePerMillionPaise: number;
  allowedPlatforms: string[];
  maxAccountsPerClipper: number;
  status: "draft" | "active" | "paused" | "ended";
  startsOn: string | null;
  endsOn: string | null;
};

const STATUS_HELP: Record<CampaignFormValues["status"], string> = {
  draft: "Draft — being set up, clippers can't post for it yet.",
  active: "Active — clippers can post and views get entered.",
  paused: "Paused — temporarily on hold.",
  ended: "Ended — finished; kept for history and payouts.",
};

export function CampaignForm({ initial, canEditRate }: { initial?: CampaignFormValues; canEditRate: boolean }) {
  const router = useRouter();
  const editing = !!initial?.id;
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    client: initial?.client ?? "",
    rate: initial ? String(paiseToRupees(initial.ratePerMillionPaise)) : "",
    platforms: initial?.allowedPlatforms ?? ["instagram", "youtube"],
    maxAccounts: String(initial?.maxAccountsPerClipper ?? 1),
    status: initial?.status ?? ("draft" as CampaignFormValues["status"]),
    startsOn: initial?.startsOn ?? "",
    endsOn: initial?.endsOn ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!form.name.trim()) local.name = "Give the campaign a name";
    if (form.platforms.length === 0) local.allowedPlatforms = "Pick at least one platform";
    if (form.startsOn && form.endsOn && form.endsOn < form.startsOn) local.endsOn = "The end date can't be before the start date";
    if (canEditRate && (form.rate.trim() === "" || Number.isNaN(Number(form.rate)))) local.rateRupees = "Enter the rate in rupees";
    if (Object.keys(local).length) {
      setErrors({ ...local, form: "Please fix the highlighted fields." });
      return;
    }

    const payload: Record<string, unknown> = {
      name: form.name,
      client: form.client,
      allowedPlatforms: form.platforms,
      maxAccountsPerClipper: Number(form.maxAccounts),
      status: form.status,
      startsOn: form.startsOn || null,
      endsOn: form.endsOn || null,
    };
    if (canEditRate) payload.rateRupees = Number(form.rate);

    if (editing && canEditRate && initial && Math.round(Number(form.rate) * 100) !== initial.ratePerMillionPaise) {
      const ok = confirm(
        `Change the rate from ${formatINR(initial.ratePerMillionPaise)} to ${formatINR(Math.round(Number(form.rate) * 100))} per 1M views?\n\nWeeks already entered keep their old rate. Only weeks entered from now on use the new rate.`,
      );
      if (!ok) return;
    }

    setSaving(true);
    setErrors({});
    try {
      if (editing) {
        await api(`/api/admin/campaigns/${initial!.id}`, { method: "PATCH", json: payload });
        setSaved(true);
        router.refresh();
      } else {
        const data = await api<{ campaign: { id: string } }>("/api/admin/campaigns", { method: "POST", json: payload });
        router.push(`/admin/campaigns/${data.campaign.id}`);
        router.refresh();
      }
    } catch (err) {
      const fields = (err as ApiError).fields ?? {};
      setErrors({ ...fields, form: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className={label}>Campaign name</label>
          <input id="c-name" className={field} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Podcast clips — Season 2" maxLength={120} required />
          {errors.name && <p className={errorText}>{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="c-client" className={label}>Client <span className="text-muted-dark">(optional)</span></label>
          <input id="c-client" className={field} value={form.client} onChange={(e) => set("client", e.target.value)} placeholder="Brand or creator" maxLength={120} />
          {errors.client && <p className={errorText}>{errors.client}</p>}
        </div>

        <div>
          <label htmlFor="c-rate" className={label}>Rate — ₹ per 1M views</label>
          {canEditRate ? (
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-dark">₹</span>
              <input id="c-rate" className={`${field} pl-8`} inputMode="decimal" type="number" min={0} step="0.01" value={form.rate}
                onChange={(e) => set("rate", e.target.value)} placeholder="e.g. 1500" required aria-describedby="c-rate-help" />
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-line bg-ink/60 px-3.5 py-2.5 text-sm text-muted-dark" id="c-rate" aria-describedby="c-rate-help">
              <Lock size={14} aria-hidden /> {initial ? formatINR(initial.ratePerMillionPaise) : "Set by the super admin"}
            </div>
          )}
          <p id="c-rate-help" className="mt-1 text-xs text-muted-dark">
            {canEditRate
              ? editing
                ? "Changing the rate only affects weeks entered after the change. Weeks already entered keep the rate they were saved with."
                : "What a clipper earns for every 1,000,000 views."
              : "Only the super admin can change the rate."}
          </p>
          {errors.rateRupees && <p className={errorText}>{errors.rateRupees}</p>}
        </div>
        <div>
          <label htmlFor="c-max" className={label}>Max accounts per clipper</label>
          <input id="c-max" className={field} type="number" inputMode="numeric" min={1} max={100} step={1} value={form.maxAccounts}
            onChange={(e) => set("maxAccounts", e.target.value)} required />
          {errors.maxAccountsPerClipper && <p className={errorText}>{errors.maxAccountsPerClipper}</p>}
        </div>

        <div>
          <label htmlFor="c-start" className={label}>Starts on <span className="text-muted-dark">(optional)</span></label>
          <input id="c-start" className={field} type="date" value={form.startsOn} onChange={(e) => set("startsOn", e.target.value)} />
          {errors.startsOn && <p className={errorText}>{errors.startsOn}</p>}
        </div>
        <div>
          <label htmlFor="c-end" className={label}>Ends on <span className="text-muted-dark">(optional)</span></label>
          <input id="c-end" className={field} type="date" value={form.endsOn} min={form.startsOn || undefined} onChange={(e) => set("endsOn", e.target.value)} />
          {errors.endsOn && <p className={errorText}>{errors.endsOn}</p>}
        </div>
      </div>

      <fieldset>
        <legend className={label}>Allowed platforms</legend>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => {
            const on = form.platforms.includes(p);
            return (
              <label key={p}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition focus-within:ring-2 focus-within:ring-lime/40 ${on ? "border-lime bg-lime/10 text-lime" : "border-line text-muted-dark hover:border-cream/40"}`}>
                <input type="checkbox" className="h-4 w-4 accent-[#C8F04A]" checked={on}
                  onChange={(e) => set("platforms", e.target.checked ? [...form.platforms, p] : form.platforms.filter((x) => x !== p))} />
                {PLATFORM_LABELS[p]}
              </label>
            );
          })}
        </div>
        {errors.allowedPlatforms && <p className={errorText}>{errors.allowedPlatforms}</p>}
      </fieldset>

      <div>
        <label htmlFor="c-status" className={label}>Status</label>
        <select id="c-status" className={`${field} sm:max-w-xs`} value={form.status} onChange={(e) => set("status", e.target.value as CampaignFormValues["status"])}>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="ended">Ended</option>
        </select>
        <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-dark"><Info size={13} className="mt-px shrink-0" aria-hidden /> {STATUS_HELP[form.status]}</p>
      </div>

      {errors.form && <p className="text-sm text-[#ff8a7a]" role="alert">{errors.form}</p>}
      {saved && <p className="text-sm text-lime" role="status">Saved.</p>}

      <Button type="submit" disabled={saving}>
        {saving ? <><LoaderCircle size={18} className="animate-spin" aria-hidden /> Saving…</> : editing ? "Save changes" : "Create campaign"}
      </Button>
    </form>
  );
}
