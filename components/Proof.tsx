import { Star } from "lucide-react";
import { SectionHeading } from "./ui/SectionHeading";
import { StatNumber } from "./ui/StatNumber";
import { Reveal } from "./ui/Reveal";

const LIVE = 33_000;
const CLIPS = 700_000;
const CHART_H = 300; // px — bars are drawn to scale against this height

function PhoneCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-[28px] border border-line bg-ink-2 px-6 pb-7 pt-9 transition-colors duration-300 hover:border-lime">
      <span aria-hidden className="absolute left-1/2 top-3 h-1.5 w-14 -translate-x-1/2 rounded-full bg-line" />
      {children}
    </div>
  );
}

export function Proof() {
  return (
    <section className="section bg-ink text-cream">
      <div className="container-site">
        <Reveal>
          <SectionHeading eyebrow="The proof" line1="Clipping is how" line2="the biggest creators grow." />
        </Reveal>

        <div className="mt-14 grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <Reveal>
            <div className="flex flex-col gap-10 rounded-3xl border border-line p-7 sm:flex-row sm:items-end md:p-10">
              <div
                className="flex items-end gap-6"
                role="img"
                aria-label="Bar chart: a livestream gets about 33K views, clips get 700K+ views"
              >
                {[
                  { label: "Live", value: "33K", h: (LIVE / CLIPS) * CHART_H, cls: "bg-[#4A4A50]" },
                  { label: "Clips", value: "700K+", h: CHART_H, cls: "bg-gradient-to-t from-olive to-lime" },
                ].map((b) => (
                  <div key={b.label} className="flex w-20 flex-col items-center md:w-24">
                    <span className="mb-2 font-display text-xl font-bold md:text-2xl">{b.value}</span>
                    <div className={`w-full rounded-t-xl ${b.cls}`} style={{ height: b.h }} />
                    <span className="mt-3 font-mono text-xs uppercase tracking-[0.18em] text-muted-dark">{b.label}</span>
                  </div>
                ))}
              </div>
              <div className="sm:pb-8">
                <p className="font-display text-[64px] font-bold leading-none text-lime md:text-[112px]">
                  ~<StatNumber value={20} suffix="×" />
                </p>
                <p className="mt-3 max-w-[16rem] font-serif text-[26px] italic leading-tight text-cream md:text-[30px]">
                  more views per clip than per livestream
                </p>
              </div>
            </div>
          </Reveal>

          <div className="grid gap-5 sm:grid-cols-3 lg:grid-cols-1">
            <Reveal delay={0.05}>
              <PhoneCard>
                <StatNumber value={1000} suffix="+" className="font-display text-5xl font-bold text-lime" />
                <p className="mt-2 text-muted-dark">clippers post for MrBeast&apos;s channel</p>
              </PhoneCard>
            </Reveal>
            <Reveal delay={0.1}>
              <PhoneCard>
                <StatNumber value={700} suffix="+" className="font-display text-5xl font-bold text-lime" />
                <p className="mt-2 text-muted-dark">clippers got Cluely tens of millions of views</p>
              </PhoneCard>
            </Reveal>
            <Reveal delay={0.15}>
              <PhoneCard>
                <Star className="text-lime" size={40} fill="currentColor" aria-hidden />
                <p className="mt-3 text-muted-dark">
                  <span className="font-bold text-cream">Polymarket &amp; ElevenLabs</span> run clip campaigns
                </p>
              </PhoneCard>
            </Reveal>
          </div>
        </div>

        <p className="source-line text-muted-dark">Sources: NPR (May 2026) · Bloomberg Law (Oct 2025)</p>
      </div>
    </section>
  );
}
