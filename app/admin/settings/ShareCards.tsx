"use client";

import { Check, Copy, Download, LoaderCircle, MessageCircle } from "lucide-react";
import { useState } from "react";
import { ErrorNote, field, smallBtn } from "@/components/portal/ui";

export const PORTAL_LOGIN_URL = "https://clipcrew.ignitralabs.com/login";

export const whatsappLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

const btnLime = "inline-flex items-center gap-2 rounded-full bg-lime px-4 py-2 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:shadow-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-ink";
const btnOutline = "inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm text-cream transition hover:border-lime hover:text-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime";

/** Copy + WhatsApp buttons for the portal login link. */
export function SharePortal() {
  const [copied, setCopied] = useState(false);
  const message = `Join the ClipCrew portal — track your campaigns, views and payouts.\nSign in here: ${PORTAL_LOGIN_URL}`;
  return (
    <div>
      <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-line bg-ink px-4 py-3">
        <span className="min-w-0 flex-1 truncate font-mono text-sm text-cream">{PORTAL_LOGIN_URL.replace("https://", "")}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={btnLime}
          onClick={() =>
            navigator.clipboard
              .writeText(PORTAL_LOGIN_URL)
              .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              })
              .catch(() => undefined)
          }
        >
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy link"}
        </button>
        <a href={whatsappLink(message)} target="_blank" rel="noopener noreferrer" className={btnOutline}>
          <MessageCircle size={15} /> Share on WhatsApp
        </a>
      </div>
    </div>
  );
}

const EXPORTS = [
  { type: "views", label: "Weekly views" },
  { type: "payouts", label: "Payouts" },
  { type: "fines", label: "Fines" },
  { type: "clippers", label: "Clippers & balances" },
] as const;

/** Download buttons for the CSV exports, with an optional campaign filter. */
export function ExportsCard({ campaigns }: { campaigns: Array<{ id: string; name: string }> }) {
  const [campaignId, setCampaignId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function download(type: string) {
    setBusy(type);
    setError("");
    try {
      const qs = new URLSearchParams({ type });
      if (campaignId) qs.set("campaignId", campaignId);
      const res = await fetch(`/api/admin/export?${qs}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't download that export.");
      }
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? `clipcrew-${type}.csv`;
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="export-campaign" className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark">
          Campaign
        </label>
        <select id="export-campaign" className={field} value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
          <option value="">All my campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        {EXPORTS.map((x) => (
          <button key={x.type} type="button" className={smallBtn} disabled={busy !== null} onClick={() => download(x.type)}>
            {busy === x.type ? <LoaderCircle size={13} className="animate-spin" /> : <Download size={13} />} {x.label}
          </button>
        ))}
      </div>
      <ErrorNote>{error}</ErrorNote>
      <p className="text-xs text-muted-dark">CSV files open in Excel or Google Sheets. Amounts are in rupees.</p>
    </div>
  );
}
