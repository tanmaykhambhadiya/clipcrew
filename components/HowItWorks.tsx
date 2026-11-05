import { ChartColumn, ClipboardList, Rocket, ScanSearch, Upload } from "lucide-react";
import { SectionHeading } from "./ui/SectionHeading";
import { Reveal } from "./ui/Reveal";

const steps = [
  {
    icon: Upload,
    title: "Share your content",
    text: "Send us your long videos, raw footage and any brand assets: logos, captions, do's and don'ts.",
    tag: "Day 0",
  },
  {
    icon: ClipboardList,
    title: "Brief, budget & target",
    text: "Together we set the view target, the platforms to post on and the rules every reel must follow.",
    tag: "Day 1",
  },
  {
    icon: Rocket,
    title: "Launch to verified clippers",
    text: "The campaign opens to clippers whose accounts we've verified. They start cutting and posting right away.",
    tag: "Launch",
  },
  {
    icon: ScanSearch,
    title: "Weekly checks & scaling",
    text: "Each week we review reels and verify views. Off-brief reels are rejected; what works gets more clippers.",
    tag: "Every week",
  },
  {
    icon: ChartColumn,
    title: "Reporting & results",
    text: "You see verified views, reels and accounts in one place, and pay only for the views that passed.",
    tag: "Ongoing",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="section scroll-mt-16 bg-ink text-cream">
      <div className="container-site">
        <Reveal>
          <SectionHeading eyebrow="How it works" line1="How a campaign runs." line2="Five steps, no guesswork." />
        </Reveal>

        <ol className="relative mt-14 grid gap-5 lg:grid-cols-5 lg:gap-4">
          {/* connecting rail (desktop: horizontal, mobile: vertical) */}
          <span aria-hidden className="absolute bottom-6 left-[27px] top-6 w-px bg-line lg:hidden" />
          <span aria-hidden className="absolute left-6 right-6 top-[27px] hidden h-px bg-line lg:block" />

          {steps.map(({ icon: Icon, title, text, tag }, i) => (
            <Reveal as="li" key={title} delay={i * 0.06} className="relative flex gap-5 lg:flex-col lg:gap-0">
              <span className="relative z-10 grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-lime bg-ink font-display text-xl font-bold text-lime">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex-1 rounded-3xl border border-line bg-ink-2 p-6 transition-colors duration-300 hover:border-lime lg:mt-6">
                <div className="flex items-center justify-between gap-3">
                  <Icon size={22} className="text-lime" aria-hidden />
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-dark">{tag}</span>
                </div>
                <h3 className="mt-4 font-serif text-[24px] italic leading-tight">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-dark">{text}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
