import { cn } from "@/lib/cn";

export const LANDING_PLATFORMS = ["Instagram Reels", "YouTube Shorts", "TikTok", "X", "Facebook"] as const;

/** Text-only platform chips (no brand logos). */
export function PlatformChips({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-2", className)} aria-label="Platforms we post to">
      {LANDING_PLATFORMS.map((p) => (
        <li
          key={p}
          className={cn(
            "rounded-full border px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] md:text-xs",
            tone === "dark" ? "border-line bg-ink-2 text-cream" : "border-ink bg-paper text-ink",
          )}
        >
          {p}
        </li>
      ))}
    </ul>
  );
}
