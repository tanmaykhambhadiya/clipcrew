"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, LoaderCircle, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { Role } from "@/lib/roles";
import { AUDIENCE_SIZES, CLIPPING_EXPERIENCE, firstErrors, waitlistSchema } from "@/lib/validation";
import { Button } from "./ui/Button";

const roleOptions: { value: Role; emoji: string; label: string }[] = [
  { value: "creator", emoji: "🎙", label: "Creator / Podcaster" },
  { value: "promoter", emoji: "🎬", label: "Film / Series promoter" },
  { value: "clipper", emoji: "✂️", label: "Clipper" },
];

const handleLabel: Record<Role, { label: string; placeholder: string }> = {
  creator: { label: "Instagram / YouTube handle or link", placeholder: "@yourchannel" },
  promoter: { label: "Film / series page — Instagram or YouTube link", placeholder: "instagram.com/yourfilm" },
  clipper: { label: "Your Instagram / YouTube clipping page", placeholder: "@yourclips" },
};

const field =
  "w-full rounded-xl border border-line bg-ink px-4 py-3 text-[15px] text-cream placeholder:text-muted-dark/50 focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/40 [color-scheme:dark]";
const labelCls = "mb-1.5 block text-sm font-medium text-cream";
const errorCls = "mt-1 text-xs text-[#ff8a7a]";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select, textarea, [tabindex]:not([tabindex="-1"])';

type Result = { kind: "joined"; position?: number } | { kind: "already" };

type Props = { initialRole: Role | null; source: string | null; onClose: () => void };

export function WaitlistModal({ initialRole, source, onClose }: Props) {
  const reduce = useReducedMotion();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const openedAt = useRef(Date.now());
  const [role, setRole] = useState<Role | null>(initialRole);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  // Esc to close, focus trap, scroll lock, focus restore.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>('[aria-checked="true"]') ?? dialog?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      } else if (!dialog.contains(document.activeElement)) {
        e.preventDefault();
        firstEl.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  // Move focus to the success heading so screen readers announce it.
  useEffect(() => {
    if (result) dialogRef.current?.querySelector<HTMLElement>("[data-success-focus]")?.focus();
  }, [result]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const parsed = waitlistSchema.safeParse({ ...raw, role: role ?? undefined });
    if (!parsed.success) {
      setErrors(firstErrors(parsed.error));
      return;
    }
    setErrors({});
    setServerError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...parsed.data,
          source: source ?? undefined,
          website: raw.website ?? "",
          elapsedMs: Date.now() - openedAt.current,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        if (data.fields) setErrors(data.fields);
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      setResult(data.already ? { kind: "already" } : { kind: "joined", position: data.position });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function onRoleKeyDown(e: React.KeyboardEvent, index: number) {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = roleOptions[(index + delta + roleOptions.length) % roleOptions.length];
    setRole(next.value);
    dialogRef.current?.querySelector<HTMLElement>(`[data-role="${next.value}"]`)?.focus();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        aria-hidden
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-ink-2 px-6 pb-8 pt-7 text-cream shadow-2xl sm:max-w-[480px] sm:rounded-3xl sm:p-9"
        initial={reduce ? false : { opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <span aria-hidden className="mx-auto -mt-2 mb-4 block h-1 w-10 rounded-full bg-line sm:hidden" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-muted-dark transition hover:bg-line hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
        >
          <X size={18} />
        </button>

        {result ? (
          <div className="py-4 text-center" aria-live="polite">
            <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-lime text-ink">
              <Check size={40} strokeWidth={3} aria-hidden />
            </span>
            {result.kind === "joined" ? (
              <>
                <h2 id={titleId} tabIndex={-1} data-success-focus className="mt-6 text-[40px] leading-[1.02] outline-none">
                  <span className="block font-display font-bold uppercase">You&apos;re in.</span>
                  <span className="block font-serif italic text-lime">We&apos;ll be in touch soon.</span>
                </h2>
                {result.position ? (
                  <p className="mt-5 font-mono text-sm uppercase tracking-[0.16em] text-muted-dark">
                    You&apos;re <span className="text-lime">#{result.position.toLocaleString("en-IN")}</span> on the list
                  </p>
                ) : null}
              </>
            ) : (
              <h2 id={titleId} tabIndex={-1} data-success-focus className="mt-6 text-[32px] leading-tight outline-none">
                <span className="block font-serif italic text-lime">You&apos;re already on the list 🙌</span>
              </h2>
            )}
            <Button className="mt-8 w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : (
          <>
            <p className="eyebrow text-lime">{"//"} Join the waitlist</p>
            <h2 id={titleId} className="mt-3 text-[40px] leading-[1.02]">
              <span className="block font-display font-bold uppercase">Be first</span>
              <span className="block font-serif italic text-lime">in line.</span>
            </h2>

            <form onSubmit={onSubmit} noValidate className="mt-7">
              <fieldset>
                <legend className={labelCls}>I am a…</legend>
                <div role="radiogroup" aria-label="I am a" className="grid gap-2.5">
                  {roleOptions.map((opt, i) => {
                    const selected = role === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        data-role={opt.value}
                        tabIndex={selected || (!role && i === 0) ? 0 : -1}
                        onClick={() => setRole(opt.value)}
                        onKeyDown={(e) => onRoleKeyDown(e, i)}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime",
                          selected ? "border-lime bg-lime text-ink" : "border-line bg-ink text-cream hover:border-lime/60",
                        )}
                      >
                        <span className="text-xl" aria-hidden>{opt.emoji}</span>
                        {opt.label}
                        {selected && <Check size={18} className="ml-auto" aria-hidden />}
                      </button>
                    );
                  })}
                </div>
                {errors.role && <p className={errorCls}>{errors.role}</p>}
              </fieldset>

              {role && (
                <motion.div
                  key={role}
                  className="mt-6 space-y-4"
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <div>
                    <label htmlFor="wl-name" className={labelCls}>Name <span className="text-lime">*</span></label>
                    <input id="wl-name" name="name" required maxLength={80} autoComplete="name" className={field} aria-invalid={!!errors.name} />
                    {errors.name && <p className={errorCls}>{errors.name}</p>}
                  </div>
                  <div>
                    <label htmlFor="wl-email" className={labelCls}>Email <span className="text-lime">*</span></label>
                    <input id="wl-email" name="email" type="email" required autoComplete="email" className={field} aria-invalid={!!errors.email} />
                    {errors.email && <p className={errorCls}>{errors.email}</p>}
                  </div>
                  <div>
                    <label htmlFor="wl-whatsapp" className={labelCls}>WhatsApp number <span className="text-muted-dark">(optional)</span></label>
                    <input id="wl-whatsapp" name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" className={field} aria-invalid={!!errors.whatsapp} />
                    {errors.whatsapp && <p className={errorCls}>{errors.whatsapp}</p>}
                  </div>
                  <div>
                    <label htmlFor="wl-handle" className={labelCls}>
                      {handleLabel[role].label} <span className="text-muted-dark">(optional)</span>
                    </label>
                    <input id="wl-handle" name="handle" maxLength={200} placeholder={handleLabel[role].placeholder} className={field} />
                    {errors.handle && <p className={errorCls}>{errors.handle}</p>}
                  </div>

                  {role === "creator" && (
                    <div>
                      <label htmlFor="wl-audience" className={labelCls}>Followers / audience size <span className="text-muted-dark">(optional)</span></label>
                      <select id="wl-audience" name="audience_size" defaultValue="" className={field}>
                        <option value="">Select…</option>
                        {AUDIENCE_SIZES.map((s) => <option key={s} value={s}>{s.replace("-", "–")}</option>)}
                      </select>
                    </div>
                  )}
                  {role === "promoter" && (
                    <div>
                      <label htmlFor="wl-release" className={labelCls}>Upcoming release date <span className="text-muted-dark">(optional)</span></label>
                      <input id="wl-release" name="release_date" type="date" className={field} aria-invalid={!!errors.release_date} />
                      {errors.release_date && <p className={errorCls}>{errors.release_date}</p>}
                    </div>
                  )}
                  {role === "clipper" && (
                    <div>
                      <label htmlFor="wl-exp" className={labelCls}>Clipping experience <span className="text-muted-dark">(optional)</span></label>
                      <select id="wl-exp" name="clipping_experience" defaultValue="" className={field}>
                        <option value="">Select…</option>
                        {CLIPPING_EXPERIENCE.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Honeypot — hidden from humans */}
              <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label htmlFor="wl-website">Website</label>
                <input id="wl-website" name="website" tabIndex={-1} autoComplete="off" />
              </div>

              {serverError && <p className="mt-5 text-sm text-[#ff8a7a]" role="alert">{serverError}</p>}

              <Button type="submit" className="mt-6 w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <LoaderCircle size={18} className="animate-spin" aria-hidden /> Saving…
                  </>
                ) : (
                  "Join Waitlist"
                )}
              </Button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
