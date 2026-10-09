import { ArrowRight, Play } from "lucide-react";
import { SectionHeading } from "./ui/SectionHeading";
import { Reveal } from "./ui/Reveal";

const steps = [
  { title: "Set the budget", text: "Choose a monthly budget and your target." },
  { title: "Clippers create", text: "Our network turns your video into reels with ClipCrew automation." },
  { title: "We verify", text: "Every clip is reviewed and its views checked." },
  { title: "Pay for results", text: "Your budget is spent only on views actually delivered." },
];

function FlowArrow() {
  return (
    <div className="flex justify-center text-lime" aria-hidden>
      <ArrowRight size={28} className="rotate-90 md:rotate-0" />
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="section scroll-mt-16 bg-ink text-cream">
      <div className="container-site">
        <Reveal>
          <SectionHeading eyebrow="How it works" line1="One video in." line2="A hundred reels out." />
        </Reveal>

        {/* Flow diagram */}
        <Reveal>
          <div
            className="mt-14 grid items-center gap-4 md:grid-cols-[1fr_auto_1.1fr_auto_1.2fr]"
            role="img"
            aria-label="One long video goes into ClipCrew's clipper network and automation, and hundreds of reels come out"
          >
            <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-3 rounded-3xl border border-line bg-ink-2 p-6">
              <span className="grid h-12 w-12 place-items-center rounded-full border border-cream/40">
                <Play size={20} fill="currentColor" className="translate-x-0.5" />
              </span>
              <span className="font-mono text-sm uppercase tracking-[0.18em]">1 long video</span>
            </div>
            <FlowArrow />
            <div className="flex h-full min-h-[140px] flex-col items-center justify-center rounded-3xl bg-lime p-6 text-center text-ink">
              <span className="font-display text-3xl font-bold uppercase">ClipCrew</span>
              <span className="mt-1 font-mono text-xs uppercase tracking-[0.14em]">Clipper network + automation</span>
            </div>
            <FlowArrow />
            <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-3 rounded-3xl border border-line bg-ink-2 p-6">
              <div className="grid grid-cols-6 gap-1.5">
                {Array.from({ length: 12 }, (_, i) => (
                  <span key={i} className="aspect-[9/16] w-5 rounded-[4px] border border-lime/70 bg-lime/10 md:w-6" />
                ))}
              </div>
              <span className="font-mono text-sm uppercase tracking-[0.18em] text-lime">100s of reels</span>
            </div>
          </div>
        </Reveal>

        {/* Steps */}
        <ol className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <Reveal
              as="li"
              key={s.title}
              delay={i * 0.06}
              className="h-full rounded-3xl border border-line bg-ink-2 p-7 transition-colors duration-300 hover:border-lime"
            >
              <span className="font-display text-6xl font-bold leading-none text-lime">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-5 font-serif text-[26px] italic leading-tight md:text-[32px]">{s.title}</h3>
              <p className="mt-3 text-muted-dark">{s.text}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
