import { SectionHeading } from "./ui/SectionHeading";
import { StatNumber } from "./ui/StatNumber";
import { Reveal } from "./ui/Reveal";

const stats = [
  { value: 200, suffix: "B", text: "YouTube Shorts views every day, worldwide" },
  { value: 97, suffix: "%", text: "of Indians surveyed watch short video every day" },
  { value: 10, suffix: " MIN", text: "to hand-edit one reel, so most long videos never get clipped" },
];

const LIME_SEGMENTS = new Set([5, 11]);

export function Problem() {
  return (
    <section className="section bg-cream text-ink">
      <div className="container-site">
        <Reveal>
          <SectionHeading tone="light" eyebrow="The problem" line1="Attention moved" line2="to short-form. Most content didn't." />
        </Reveal>

        <div className="mt-14 grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-center lg:gap-16">
          <Reveal>
            <ul className="border-t border-ink/80">
              {stats.map((s) => (
                <li key={s.text} className="flex flex-col gap-2 border-b border-ink/80 py-6 sm:flex-row sm:items-center sm:gap-8">
                  <StatNumber
                    value={s.value}
                    suffix={s.suffix}
                    className="shrink-0 font-display text-[56px] font-bold uppercase leading-none sm:w-[260px] md:text-[80px]"
                  />
                  <p className="text-base text-muted-light md:text-lg">{s.text}</p>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.1}>
            <figure className="rounded-3xl border border-line bg-ink p-7 text-cream md:p-9">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-dark md:text-sm">1 episode · 60 min</p>
              <div className="mt-6 grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1" aria-hidden>
                {Array.from({ length: 16 }, (_, i) => (
                  <span key={i} className={`h-12 rounded-[4px] ${LIME_SEGMENTS.has(i) ? "bg-lime" : "bg-line"}`} />
                ))}
              </div>
              <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-muted-dark/70" aria-hidden>
                <span>00:00</span>
                <span>60:00</span>
              </div>
              <figcaption className="mt-6 font-serif text-[26px] italic leading-tight text-lime md:text-[32px]">
                The best moments stay buried.
              </figcaption>
            </figure>
          </Reveal>
        </div>

        <p className="source-line text-muted-light">
          Sources: YouTube, Cannes Lions (Jun 2025) · Meta–Ipsos study (Sep 2025)
        </p>
      </div>
    </section>
  );
}
