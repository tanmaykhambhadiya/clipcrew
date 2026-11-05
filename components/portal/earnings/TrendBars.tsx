import { formatINR } from "@/lib/portal/money";
import { formatWeek } from "@/lib/portal/weeks";

/** Small inline-SVG bar trend of weekly earnings (oldest → newest). No chart library. */
export function TrendBars({ points }: { points: { weekStart: string; amountPaise: number }[] }) {
  if (points.length === 0) return null;
  const W = 240;
  const H = 64;
  const gap = points.length > 16 ? 2 : 4;
  const barW = Math.max(2, (W - gap * (points.length - 1)) / points.length);
  const max = Math.max(...points.map((p) => p.amountPaise), 1);
  const lastIdx = points.length - 1;
  const total = points.reduce((s, p) => s + p.amountPaise, 0);

  return (
    <figure className="w-full max-w-[320px]">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-20 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Weekly earnings over ${points.length} weeks, ${formatINR(total)} in total`}
      >
        <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} stroke="#2A2A31" strokeWidth={1} />
        {points.map((p, i) => {
          const h = p.amountPaise > 0 ? Math.max(3, (p.amountPaise / max) * (H - 4)) : 1.5;
          return (
            <rect
              key={p.weekStart}
              x={i * (barW + gap)}
              y={H - h}
              width={barW}
              height={h}
              rx={Math.min(3, barW / 2)}
              fill={i === lastIdx ? "#C8F04A" : p.amountPaise > 0 ? "rgba(200,240,74,0.45)" : "#2A2A31"}
            >
              <title>{`${formatWeek(p.weekStart)}: ${formatINR(p.amountPaise)}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="mt-1.5 flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-muted-dark">
        <span>{formatWeek(points[0].weekStart).replace(/ \d{4}$/, "")}</span>
        <span>This week</span>
      </figcaption>
    </figure>
  );
}
