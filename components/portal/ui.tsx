// Shared building blocks for /admin and /portal screens — ClipCrew theme (ink + lime, Oswald / Instrument Serif / DM Sans / JetBrains Mono).
import { cn } from "@/lib/cn";

/** Input/select/textarea class. */
export const field =
  "w-full rounded-xl border border-line bg-ink px-3.5 py-2.5 text-sm text-cream placeholder:text-muted-dark/50 focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/40 disabled:opacity-60 [color-scheme:dark]";

export const label = "mb-1.5 block text-sm font-medium text-cream";
export const errorText = "mt-1 text-xs text-[#ff8a7a]";

/** Small outline button used in tables/toolbars. */
export const smallBtn =
  "inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-muted-dark transition hover:border-lime hover:text-lime disabled:pointer-events-none disabled:opacity-50";

/** Eyebrow + Oswald line + Instrument Serif italic line (app-sized version of the marketing SectionHeading). */
export function PageTitle({ eyebrow, line1, line2, children }: { eyebrow: string; line1: string; line2: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow text-lime">{"//"} {eyebrow}</p>
        <h1 className="mt-3 text-[34px] leading-[1.02] md:text-[48px]">
          <span className="block font-display font-bold uppercase">{line1}</span>
          <span className="block font-serif italic text-lime">{line2}</span>
        </h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-3xl border border-line bg-ink-2 p-6 md:p-7", className)}>{children}</div>;
}

/** Mono uppercase label. */
export function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={cn("font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark", className)}>{children}</p>;
}

const pillTones = {
  lime: "bg-lime/15 text-lime",
  red: "bg-[#ff8a7a]/15 text-[#ff8a7a]",
  amber: "bg-[#f5c451]/15 text-[#f5c451]",
  grey: "bg-line text-muted-dark",
  cyan: "bg-[#6fd3e8]/15 text-[#6fd3e8]",
};

export function Pill({ tone = "grey", children }: { tone?: keyof typeof pillTones; children: React.ReactNode }) {
  return (
    <span className={cn("inline-block rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em]", pillTones[tone])}>
      {children}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-line px-6 py-12 text-center">
      <p className="font-serif text-2xl italic text-cream">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-muted-dark">{children}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="text-sm text-[#ff8a7a]" role="alert">
      {children}
    </p>
  );
}

/** Table wrapper: scrolls horizontally inside its card on small screens. */
export function TableWrap({ minWidth = 720, children }: { minWidth?: number; children: React.ReactNode }) {
  return (
    // `relative` makes this the containing block for absolutely positioned children (e.g. sr-only
    // header labels) so they're clipped by the scroller instead of widening the page on phones.
    <div className="relative overflow-x-auto rounded-3xl border border-line">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export const th = "px-5 py-4 font-mono text-[11px] font-normal uppercase tracking-[0.16em] text-muted-dark";
export const td = "px-5 py-4 align-top";
export const tr = "border-b border-line/60 last:border-0";

export const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
  x: "X",
  other: "Other",
};
export const PLATFORMS = ["instagram", "youtube", "tiktok", "facebook", "x", "other"] as const;
