import { ArrowRight } from "lucide-react";
import { TEAM } from "@/lib/team";
import { SectionHeading } from "./ui/SectionHeading";
import { Reveal } from "./ui/Reveal";
import { JoinWaitlistLink } from "./JoinWaitlistButton";
import { TrackRecord } from "./TrackRecord";

/** Credibility block: track record + the team behind ClipCrew. */
export function Team() {
  return (
    <section id="team" className="section scroll-mt-16 bg-cream text-ink">
      <div className="container-site">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end lg:gap-16">
          <Reveal>
            <SectionHeading tone="light" eyebrow="Track record" line1="We clipped" line2="before we built." />
          </Reveal>
          <Reveal>
            <p className="text-muted-light md:text-lg">
              Before writing a line of code, we ran a clipping campaign ourselves: cutting, posting and checking every
              reel by hand. Everything ClipCrew does today comes from what worked in those two months.
            </p>
          </Reveal>
        </div>

        <div className="mt-12">
          <TrackRecord />
        </div>

        <Reveal>
          <div className="mt-5 flex flex-col items-start justify-between gap-5 rounded-3xl bg-ink px-7 py-6 text-cream md:flex-row md:items-center md:px-10">
            <p className="font-serif text-[26px] italic leading-tight md:text-[32px]">
              Now: <span className="text-lime">~25 clippers</span> already in the ClipCrew community.
            </p>
            <JoinWaitlistLink
              role="clipper"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-lime px-6 py-3 font-bold text-ink transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              Join them <ArrowRight size={18} />
            </JoinWaitlistLink>
          </div>
        </Reveal>

        <p className="mt-16 font-mono text-xs uppercase tracking-[0.18em] text-olive">{"//"} The crew behind ClipCrew</p>
        <ul className="mt-6 grid gap-5 md:grid-cols-3">
          {TEAM.map((m, i) => (
            <Reveal
              as="li"
              key={m.name}
              delay={i * 0.06}
              className="flex items-center gap-5 rounded-3xl border border-ink bg-paper p-6 transition-colors duration-300 hover:border-olive md:flex-col md:p-9 md:text-center"
            >
              <span
                aria-hidden
                className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-ink font-display text-3xl font-bold text-lime md:h-32 md:w-32 md:text-5xl"
              >
                {m.initials}
              </span>
              <div className="min-w-0">
                <h3 className="font-serif text-[24px] italic leading-tight md:text-[30px]">{m.name}</h3>
                <p className="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-olive md:text-sm">{m.role}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
