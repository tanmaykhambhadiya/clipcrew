import { TEAM } from "@/lib/team";
import { SectionHeading } from "./ui/SectionHeading";
import { Reveal } from "./ui/Reveal";

export function Team() {
  return (
    <section id="team" className="section scroll-mt-16 bg-ink text-cream">
      <div className="container-site">
        <Reveal>
          <SectionHeading eyebrow="Team" line1="The crew" line2="behind ClipCrew." />
        </Reveal>

        <ul className="mt-14 grid gap-5 md:grid-cols-3">
          {TEAM.map((m, i) => (
            <Reveal
              as="li"
              key={m.name}
              delay={i * 0.06}
              className="flex flex-col items-center rounded-3xl border border-line bg-ink-2 p-8 text-center transition-colors duration-300 hover:border-lime md:p-10"
            >
              <span
                aria-hidden
                className="grid h-40 w-40 place-items-center rounded-full bg-lime font-display text-6xl font-bold text-ink"
              >
                {m.initials}
              </span>
              <h3 className="mt-7 font-serif text-[26px] italic leading-tight md:text-[32px]">{m.name}</h3>
              <p className="mt-2 font-mono text-xs uppercase tracking-[0.18em] text-lime md:text-sm">{m.role}</p>
            </Reveal>
          ))}
        </ul>

        <p className="mt-10 text-center text-muted-dark md:text-lg">
          Hands-on clippers first: up to 25M views a month at our peak.
        </p>
      </div>
    </section>
  );
}
