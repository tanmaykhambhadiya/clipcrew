import { cn } from "@/lib/cn";

export function ReelFrame({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative aspect-[9/16] overflow-hidden rounded-[22px] border-2 border-lime bg-ink-2 shadow-[0_24px_60px_rgba(0,0,0,0.45)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
