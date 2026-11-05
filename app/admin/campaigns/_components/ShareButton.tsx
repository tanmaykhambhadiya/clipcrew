"use client";

import { Check, Copy, Send, Share2 } from "lucide-react";
import { useState } from "react";
import { smallBtn } from "@/components/portal/ui";

/** Copies the invite text and opens WhatsApp with it pre-filled. */
export function ShareButton({ message }: { message: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const waLink = `https://wa.me/?text=${encodeURIComponent(message)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="relative">
      <button type="button" className="inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:shadow-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
        aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Share2 size={16} aria-hidden /> Share
      </button>
      {open && (
        <div className="mt-3 w-full max-w-[min(420px,calc(100vw-40px))] rounded-3xl border border-line bg-ink-2 p-5 sm:absolute sm:right-0 sm:z-20 sm:w-[420px]">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark">Invite message</p>
          <pre className="mt-3 whitespace-pre-wrap break-words rounded-2xl border border-line bg-ink p-4 font-sans text-sm text-cream">{message}</pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={smallBtn} onClick={copy}>
              {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />} {copied ? "Copied" : "Copy text"}
            </button>
            <a className={smallBtn} href={waLink} target="_blank" rel="noopener noreferrer" onClick={() => void copy()}>
              <Send size={13} aria-hidden /> Share on WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
