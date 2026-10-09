import { ScanEye, Scissors, Sparkles, Users } from "lucide-react";
import { SectionHeading } from "./ui/SectionHeading";
import { Reveal } from "./ui/Reveal";

const rows = [
  { icon: Users, title: "For creators", text: "Launch campaigns, set budgets, track views live." },
  { icon: Scissors, title: "For clippers", text: "Submit clips; see approvals, rejections and payouts." },
  { icon: ScanEye, title: "For ClipCrew", text: "Review clips, verify views, run payouts automatically." },
];

// Illustrative rising series for the mockup chart (0–100 scale).
const series = [8, 12, 10, 18, 22, 20, 31, 36, 34, 47, 55, 61, 58, 72, 84, 93];

function Chart() {
  const w = 400;
  const h = 140;
  const pts = series.map((v, i) => [(i / (series.length - 1)) * w, h - (v / 100) * h] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="dash-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C8F04A" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#C8F04A" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={w} y1={h * f} y2={h * f} stroke="#2A2A31" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      ))}
      <polygon points={`0,${h} ${line} ${w},${h}`} fill="url(#dash-fill)" />
      <polyline points={line} fill="none" stroke="#C8F04A" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function DashboardMockup() {
  const tiles = [
    { label: "Views", value: "1.24M", delta: "+18%" },
    { label: "Clips", value: "486", delta: "+42" },
    { label: "Budget", value: "68%", delta: "used" },
  ];
  return (
    <div className="overflow-x-auto rounded-3xl border border-ink bg-ink p-1.5 shadow-[0_30px_80px_rgba(17,17,20,0.25)]">
      <div className="min-w-[540px] overflow-hidden rounded-[20px] border border-line bg-ink" role="img" aria-label="ClipCrew dashboard preview with views, clips and budget tiles and a rising views chart">
        <div className="flex items-center gap-1.5 border-b border-line px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#4A4A50]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#4A4A50]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#4A4A50]" />
          <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-dark/70">app.clipcrew</span>
        </div>
        <div className="grid grid-cols-[130px_1fr]">
          <ul className="space-y-1 border-r border-line p-3 text-sm text-muted-dark">
            {["Campaigns", "Clippers", "Reviews", "Payouts"].map((item, i) => (
              <li key={item} className={i === 0 ? "rounded-lg bg-ink-2 px-3 py-2 text-cream" : "px-3 py-2"}>
                {item}
              </li>
            ))}
          </ul>
          <div className="p-4">
            <div className="grid grid-cols-3 gap-2.5">
              {tiles.map((t) => (
                <div key={t.label} className="rounded-xl border border-line bg-ink-2 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-dark">{t.label}</p>
                  <p className="mt-1 font-display text-2xl font-bold text-cream">{t.value}</p>
                  <p className="font-mono text-[10px] text-lime">{t.delta}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-line bg-ink-2 p-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-dark">Views · last 30 days</p>
              <Chart />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Platform() {
  return (
    <section id="platform" className="section scroll-mt-16 bg-cream text-ink">
      <div className="container-site">
        <Reveal>
          <SectionHeading tone="light" eyebrow="The platform" line1="One platform." line2="Every side of the campaign." />
        </Reveal>

        <div className="mt-14 grid gap-12 lg:grid-cols-[1.25fr_1fr] lg:items-center lg:gap-16">
          <Reveal className="min-w-0">
            <DashboardMockup />
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-light">
              Product preview · illustrative data
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <ul className="space-y-6">
              {rows.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-ink bg-paper text-olive">
                    <Icon size={22} aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-serif text-[26px] italic leading-tight">{title}</h3>
                    <p className="mt-1 text-muted-light">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-8 inline-flex flex-wrap items-center gap-2 rounded-full bg-lime px-5 py-2.5 text-sm text-ink">
              <Sparkles size={16} aria-hidden />
              <span className="font-bold">Tools for clippers:</span> reel automation · auto-submit
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
