"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { compactViews, formatINR } from "@/lib/portal/money";

export type ImpactRow = { key: string; name: string; sub?: string; amountPaise: number; views: number };

/** "Where your impact is" — By campaign / By account, each row with a bar relative to the top row. */
export function ImpactBreakdown({ byCampaign, byAccount }: { byCampaign: ImpactRow[]; byAccount: ImpactRow[] }) {
  const [mode, setMode] = useState<"campaign" | "account">("campaign");
  const rows = mode === "campaign" ? byCampaign : byAccount;
  const max = Math.max(...rows.map((r) => r.amountPaise), 1);
  const maxViews = Math.max(...rows.map((r) => r.views), 1);
  const allZeroMoney = rows.every((r) => r.amountPaise === 0);

  return (
    <div>
      <div role="group" aria-label="Group by" className="inline-flex rounded-full border border-line p-1">
        {(
          [
            ["campaign", "By campaign"],
            ["account", "By account"],
          ] as const
        ).map(([value, text]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime",
              mode === value ? "bg-lime font-semibold text-ink" : "text-muted-dark hover:text-lime",
            )}
          >
            {text}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-dark">Nothing in this period yet.</p>
      ) : (
        <ul className="mt-6 space-y-5">
          {rows.map((r) => {
            const pct = allZeroMoney ? (r.views / maxViews) * 100 : (r.amountPaise / max) * 100;
            return (
              <li key={r.key}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="min-w-0 truncate text-sm font-medium text-cream">
                    {r.name}
                    {r.sub && <span className="ml-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-dark">{r.sub}</span>}
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold text-cream">{formatINR(r.amountPaise)}</span>
                    <span className="text-muted-dark"> · {compactViews(r.views)} views</span>
                  </p>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-ink" aria-hidden>
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-olive to-lime"
                    style={{ width: `${Math.max(pct, r.amountPaise > 0 || r.views > 0 ? 2 : 0)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
