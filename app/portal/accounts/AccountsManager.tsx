"use client";

import { Check, Copy, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, type ApiError } from "@/lib/portal/client";
import { formatDate } from "@/lib/portal/weeks";
import { Button } from "@/components/ui/Button";
import {
  Card,
  EmptyState,
  ErrorNote,
  Label,
  PLATFORMS,
  PLATFORM_LABELS,
  Pill,
  TableWrap,
  errorText,
  field,
  label,
  smallBtn,
  td,
  th,
  tr,
} from "@/components/portal/ui";
import { MAX_ACCOUNTS_PER_CLIPPER, normaliseHandle, platformFromInput, type Platform } from "./handle";

export type ClipperAccount = {
  id: string;
  platform: string;
  username: string;
  verify_code: string;
  status: "pending" | "verified" | "rejected";
  verified_at: string | null;
  created_at: string;
  reason: string | null;
};

const STATUS_TONE = { pending: "amber", verified: "lime", rejected: "red" } as const;

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard
          ?.writeText(code)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          })
          .catch(() => undefined)
      }
      className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 font-mono text-sm tracking-wider text-cream transition hover:border-lime hover:text-lime"
      aria-label={`Copy code ${code}`}
    >
      {code} {copied ? <Check size={14} className="text-lime" /> : <Copy size={14} />}
    </button>
  );
}

function AddAccountDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (a: ClipperAccount) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [handle, setHandle] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  function reset() {
    setHandle("");
    setErrors({});
  }

  function onHandleChange(v: string) {
    setHandle(v);
    const p = platformFromInput(v);
    if (p) setPlatform(p); // pasted a profile link: pick the platform for them
  }

  const preview = handle.trim() ? normaliseHandle(handle, platform) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    if (preview && "error" in preview) {
      setErrors({ handle: preview.error });
      return;
    }
    setSaving(true);
    try {
      const data = await api<{ account: ClipperAccount }>("/api/portal/accounts", { method: "POST", json: { platform, handle } });
      reset();
      onAdded({ ...data.account, reason: null });
    } catch (err) {
      const e2 = err as ApiError;
      setErrors({ ...(e2.fields ?? {}), form: e2.fields?.handle ? "" : e2.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={() => {
        reset();
        onClose();
      }}
      className="w-[calc(100%-32px)] max-w-lg rounded-3xl border border-line bg-ink-2 p-0 text-cream backdrop:bg-black/70"
      aria-labelledby="add-account-title"
    >
      <form onSubmit={submit} className="space-y-5 p-6 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label className="text-lime">New account</Label>
            <h2 id="add-account-title" className="mt-2 font-display text-2xl font-bold uppercase">
              Add an account
            </h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border border-line text-muted-dark hover:text-cream" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div>
          <label htmlFor="acc-handle" className={label}>
            Username or profile link
          </label>
          <input
            id="acc-handle"
            className={field}
            value={handle}
            onChange={(e) => onHandleChange(e.target.value)}
            placeholder="@yourhandle or https://instagram.com/yourhandle"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            aria-invalid={!!errors.handle}
            aria-describedby="acc-handle-help"
          />
          {errors.handle ? (
            <p className={errorText}>{errors.handle}</p>
          ) : (
            <p id="acc-handle-help" className="mt-1 text-xs text-muted-dark">
              {preview && "username" in preview ? (
                <>
                  We&apos;ll save it as <span className="font-mono text-cream">@{preview.username}</span>
                </>
              ) : (
                "Paste your profile link or type the handle — either works."
              )}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="acc-platform" className={label}>
            Platform
          </label>
          <select id="acc-platform" className={field} value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABELS[p]}
              </option>
            ))}
          </select>
          {errors.platform && <p className={errorText}>{errors.platform}</p>}
        </div>

        <p className="rounded-2xl border border-line bg-ink p-4 text-sm text-muted-dark">
          Next you&apos;ll get a code like <span className="font-mono text-cream">CC-7K2P9Q</span>. Put it in your bio so our team can confirm the account is yours.
        </p>

        <ErrorNote>{errors.form}</ErrorNote>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />} Get my code
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </dialog>
  );
}

export function AccountsManager({ accounts }: { accounts: ClipperAccount[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [justAdded, setJustAdded] = useState<ClipperAccount | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState("");
  const atLimit = accounts.length >= MAX_ACCOUNTS_PER_CLIPPER;

  async function remove(a: ClipperAccount) {
    if (!window.confirm(`Remove @${a.username} (${PLATFORM_LABELS[a.platform] ?? a.platform})? You can add it again later.`)) return;
    setBusy(a.id);
    setRowError("");
    try {
      await api(`/api/portal/accounts/${a.id}`, { method: "DELETE" });
      if (justAdded?.id === a.id) setJustAdded(null);
      router.refresh();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Couldn't remove the account.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-dark">
          Add every account you post clips from. Once verified, pick which ones count toward each campaign on the Campaigns page.
        </p>
        <Button size="sm" onClick={() => setOpen(true)} disabled={atLimit}>
          <Plus size={16} /> Add account
        </Button>
      </div>
      {atLimit && <p className="text-sm text-[#f5c451]">You&apos;ve reached the {MAX_ACCOUNTS_PER_CLIPPER}-account limit. Remove one to add another.</p>}

      {justAdded && (
        <Card className="border-lime bg-lime/10">
          <Label className="text-lime">One more step</Label>
          <p className="mt-3 text-lg">
            Add <span className="font-mono font-semibold text-lime">{justAdded.verify_code}</span> to your{" "}
            {PLATFORM_LABELS[justAdded.platform] ?? ""} bio for <span className="font-mono">@{justAdded.username}</span>, then wait — our team verifies within 48 hours.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <CopyCode code={justAdded.verify_code} />
            <button type="button" className={smallBtn} onClick={() => setJustAdded(null)}>
              Got it
            </button>
          </div>
          <p className="mt-3 text-xs text-muted-dark">Keep the code in your bio until the account shows Verified. You&apos;ll get a message in your inbox.</p>
        </Card>
      )}

      <ErrorNote>{rowError}</ErrorNote>

      {accounts.length === 0 ? (
        <EmptyState title="No accounts yet">
          Add your first Instagram, YouTube, TikTok, X or Facebook account to start earning from campaigns.
        </EmptyState>
      ) : (
        <TableWrap minWidth={680}>
          <thead>
            <tr className={tr}>
              <th className={th}>Platform</th>
              <th className={th}>Account</th>
              <th className={th}>Status</th>
              <th className={th}>Bio code</th>
              <th className={th}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className={tr}>
                <td className={td}>{PLATFORM_LABELS[a.platform] ?? a.platform}</td>
                <td className={td}>
                  <span className="font-mono">@{a.username}</span>
                  <p className="mt-1 text-xs text-muted-dark">Added {formatDate(a.created_at)}</p>
                </td>
                <td className={td}>
                  <Pill tone={STATUS_TONE[a.status]}>{a.status}</Pill>
                  {a.status === "verified" && a.verified_at && <p className="mt-1 text-xs text-muted-dark">{formatDate(a.verified_at)}</p>}
                  {a.status === "pending" && <p className="mt-1 text-xs text-muted-dark">Checked within 48h</p>}
                  {a.status === "rejected" && a.reason && <p className="mt-1 max-w-[220px] text-xs text-[#ff8a7a]">{a.reason}</p>}
                </td>
                <td className={td}>
                  {a.status === "verified" ? (
                    <span className="font-mono text-sm text-muted-dark">{a.verify_code}</span>
                  ) : (
                    <CopyCode code={a.verify_code} />
                  )}
                  {a.status === "verified" && <p className="mt-1 text-xs text-muted-dark">You can remove it from your bio now.</p>}
                </td>
                <td className={`${td} text-right`}>
                  {a.status !== "verified" && (
                    <button type="button" className={smallBtn} onClick={() => remove(a)} disabled={busy === a.id} aria-label={`Remove @${a.username}`}>
                      {busy === a.id ? <LoaderCircle size={13} className="animate-spin" /> : <Trash2 size={13} />} Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      <AddAccountDialog
        open={open}
        onClose={() => setOpen(false)}
        onAdded={(a) => {
          setOpen(false);
          setJustAdded(a);
          router.refresh();
        }}
      />
    </div>
  );
}
