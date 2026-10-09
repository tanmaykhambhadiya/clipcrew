"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { contactSchema, firstErrors } from "@/lib/validation";

const input =
  "w-full rounded-xl border border-line bg-ink-2 px-3.5 py-2.5 text-sm text-cream placeholder:text-muted-dark/60 focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/40";

type Status = "idle" | "sending" | "sent" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const raw = Object.fromEntries(fd) as Record<string, string>;
    const parsed = contactSchema.safeParse(raw);
    if (!parsed.success) {
      setErrors(firstErrors(parsed.error));
      return;
    }
    setErrors({});
    setServerError("");
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed.data, website: raw.website ?? "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Something went wrong.");
      setStatus("sent");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="w-full max-w-[380px] md:w-[380px]" aria-live="polite">
        <p className="eyebrow text-lime">{"//"} Say hello</p>
        <p className="mt-4 text-cream">Thanks — we&apos;ll reply soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="w-full max-w-[380px] md:w-[380px]" aria-labelledby="contact-title">
      <p id="contact-title" className="eyebrow text-lime">{"//"} Say hello</p>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div>
          <label htmlFor="c-name" className="sr-only">Name</label>
          <input id="c-name" name="name" placeholder="Name" maxLength={80} autoComplete="name" className={input} aria-invalid={!!errors.name} />
          {errors.name && <p className="mt-1 text-xs text-[#ff8a7a]">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="c-email" className="sr-only">Email</label>
          <input id="c-email" name="email" type="email" placeholder="Email" autoComplete="email" className={input} aria-invalid={!!errors.email} />
          {errors.email && <p className="mt-1 text-xs text-[#ff8a7a]">{errors.email}</p>}
        </div>
        <div className="col-span-2">
          <label htmlFor="c-message" className="sr-only">Message</label>
          <textarea id="c-message" name="message" rows={2} maxLength={500} placeholder="Message" className={`${input} resize-none`} aria-invalid={!!errors.message} />
          {errors.message && <p className="mt-1 text-xs text-[#ff8a7a]">{errors.message}</p>}
        </div>
      </div>
      {/* Honeypot — hidden from humans */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="c-website">Website</label>
        <input id="c-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="mt-3 flex items-center justify-end gap-3">
        {serverError && <p className="mr-auto text-xs text-[#ff8a7a]" role="alert">{serverError}</p>}
        <button
          type="submit"
          disabled={status === "sending"}
          className="inline-flex items-center gap-1.5 rounded-full bg-lime px-5 py-2 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:shadow-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:opacity-60"
        >
          {status === "sending" ? <LoaderCircle size={16} className="animate-spin" aria-label="Sending" /> : <>Send <ArrowRight size={16} /></>}
        </button>
      </div>
    </form>
  );
}
