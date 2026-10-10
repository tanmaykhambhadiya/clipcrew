import { ArrowRight } from "lucide-react";
import { SectionHeading } from "./ui/SectionHeading";
import { StatNumber } from "./ui/StatNumber";
import { Reveal } from "./ui/Reveal";
import { JoinWaitlistLink } from "./JoinWaitlistButton";

const tiles = [
  { value: 2, suffix: " MO", text: "live campaign" },
  { value: 25, suffix: "M", text: "views a month at our peak" },
  { value: 5, suffix: " × 1M+", text: "reels past 1M views" },
  { value: 15, suffix: "", text: "accounts run by a 5-person team" },
];

export function TrackRecord() {
  return (
    <section className="section bg-ink text-cream">
      <div className="container-site">
        <Reveal>
          <SectionHeading eyebrow="Track record" line1="2 months in the game." line2="Before we built the platform." />
        </Reveal>

        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t, i) => (
            <Reveal
              as="li"
              key={t.text}
              delay={i * 0.06}
              className="rounded-3xl border border-line border-t-4 border-t-lime bg-ink-2 p-7 transition-colors duration-300 hover:border-lime"
            >
              <StatNumber
                value={t.value}
                suffix={t.suffix}
                className="block font-display text-[48px] font-bold leading-none text-cream md:text-[56px]"
              />
              <p className="mt-3 text-muted-dark">{t.text}</p>
            </Reveal>
          ))}
        </ul>

        <Reveal>
          <div className="mt-8 flex flex-col items-start justify-between gap-5 rounded-3xl bg-lime px-7 py-6 text-ink md:flex-row md:items-center md:px-10">
            <p className="font-serif text-[26px] italic leading-tight md:text-[32px]">
              Now: ~25 clippers already in the ClipCrew community.
            </p>
            <JoinWaitlistLink
              role="clipper"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-ink px-6 py-3 font-bold text-lime transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-lime"
            >
              Join them <ArrowRight size={18} />
            </JoinWaitlistLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
