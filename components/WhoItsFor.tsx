import { ArrowRight, Clapperboard, Mic, Star } from "lucide-react";
import type { Role } from "@/lib/roles";
import { SectionHeading } from "./ui/SectionHeading";
import { Reveal } from "./ui/Reveal";
import { JoinWaitlistLink } from "./JoinWaitlistButton";

const audiences: { icon: typeof Mic; title: string; text: string; role: Role; cta: string }[] = [
  { icon: Mic, title: "Podcasters", text: "Every episode becomes dozens of reels.", role: "creator", cta: "Join as podcaster" },
  { icon: Star, title: "Creators", text: "Reach people far beyond your followers.", role: "creator", cta: "Join as creator" },
  {
    icon: Clapperboard,
    title: "Film & series promoters",
    text: "Flood feeds before and after release day.",
    role: "promoter",
    cta: "Join as promoter",
  },
];

export function WhoItsFor() {
  return (
    <section className="section bg-cream text-ink">
      <div className="container-site">
        <Reveal>
          <SectionHeading tone="light" eyebrow="Who it's for" line1="Built for" line2="people with stories worth clipping." />
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {audiences.map(({ icon: Icon, title, text, role, cta }, i) => (
            <Reveal key={title} delay={i * 0.06} className="h-full">
              <article className="flex h-full flex-col rounded-3xl border border-ink bg-paper p-7 transition-colors duration-300 hover:border-olive md:p-9">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ink text-lime">
                  <Icon size={26} aria-hidden />
                </span>
                <h3 className="mt-6 font-serif text-[26px] italic leading-tight md:text-[32px]">{title}</h3>
                <p className="mt-2 flex-1 text-muted-light md:text-lg">{text}</p>
                <JoinWaitlistLink
                  role={role}
                  className="group mt-6 inline-flex items-center gap-2 self-start font-mono text-xs font-semibold uppercase tracking-[0.16em] text-olive hover:text-ink"
                >
                  {cta} <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                </JoinWaitlistLink>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
