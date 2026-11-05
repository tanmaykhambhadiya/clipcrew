"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { field } from "@/components/portal/ui";

const RANGES = [
  { value: "4", label: "Last 4 weeks" },
  { value: "12", label: "Last 12 weeks" },
  { value: "all", label: "All time" },
] as const;

/** Campaign + range selects that write to the URL (?c=…&r=…); the server page re-renders from them. */
export function EarningsFilters({
  campaigns,
  campaign,
  range,
}: {
  campaigns: { id: string; name: string }[];
  campaign: string;
  range: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  function set(key: "c" | "r", value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || (key === "r" && value === "4")) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    start(() => router.push(qs ? `${path}?${qs}` : path, { scroll: false }));
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="sm:w-64">
        <label htmlFor="f-campaign" className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark">
          Campaign
        </label>
        <select id="f-campaign" className={field} value={campaign} onChange={(e) => set("c", e.target.value)}>
          <option value="">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:w-48">
        <label htmlFor="f-range" className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark">
          Period
        </label>
        <select id="f-range" className={field} value={range} onChange={(e) => set("r", e.target.value)}>
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      {pending && (
        <p className="flex items-center gap-2 pb-2.5 text-xs text-muted-dark" role="status">
          <LoaderCircle size={14} className="animate-spin" /> Updating…
        </p>
      )}
    </div>
  );
}
