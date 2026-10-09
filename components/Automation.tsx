import fs from "node:fs";
import path from "node:path";
import { Check } from "lucide-react";
import { SectionHeading } from "./ui/SectionHeading";
import { StatNumber } from "./ui/StatNumber";
import { Reveal } from "./ui/Reveal";

const steps = [
  { label: "01 Upload", text: "Paste a Drive or video link, or upload from phone or PC." },
  { label: "02 Trim", text: "Pick timestamps, or let AI read the transcript and find the best moments." },
  { label: "03 Multiply", text: "One clip becomes 10–20 reels, each testing its own hook text and banner." },
  { label: "04 Describe", text: "Captions and descriptions are written automatically." },
];

// The demo slot only renders when /public/demo.mp4 exists (checked at build time).
const hasDemo = fs.existsSync(path.join(process.cwd(), "public", "demo.mp4"));

export function Automation() {
  return (
    <section id="automation" className="section scroll-mt-16 bg-ink bg-glow text-cream">
      <div className="container-site">
        <Reveal>
          <SectionHeading eyebrow="Our edge" line1="20 reels in 2 minutes." line2="Not 3 hours." />
        </Reveal>

        <div className="mt-14 grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          <Reveal>
            <ol className="space-y-7">
              {steps.map((s) => (
                <li key={s.label} className="grid gap-1 border-l-2 border-line pl-5 transition-colors hover:border-lime sm:grid-cols-[140px_1fr] sm:gap-6">
                  <span className="pt-1 font-mono text-sm font-semibold uppercase tracking-[0.18em] text-lime">{s.label}</span>
                  <span className="text-muted-dark md:text-lg">{s.text}</span>
                </li>
              ))}
            </ol>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="rounded-3xl border border-line bg-ink-2 p-7 md:p-10">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-dark">By hand</p>
                  <p className="mt-3 font-display text-[56px] font-bold leading-none text-[#6B6B72] md:text-[72px]">7–8</p>
                  <p className="mt-2 text-sm text-muted-dark">reels per hour</p>
                </div>
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-lime">With ClipCrew</p>
                  <StatNumber
                    value={20}
                    className="mt-3 block font-display text-[88px] font-bold leading-none text-lime md:text-[128px]"
                  />
                  <p className="mt-2 text-sm text-cream">reels in 2 minutes</p>
                </div>
              </div>
              <span className="mt-8 inline-flex items-center gap-2 rounded-full bg-lime px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink">
                <Check size={14} strokeWidth={3} aria-hidden /> Live today
              </span>
            </div>
          </Reveal>
        </div>

        {hasDemo && (
          <Reveal>
            <video
              className="mt-14 w-full rounded-3xl border border-line"
              src="/demo.mp4"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-label="Demo of ClipCrew automation turning one clip into many reels"
            />
          </Reveal>
        )}
      </div>
    </section>
  );
}
