import { ArrowRight, Check, Flame, Repeat, Zap } from "lucide-react";
import type { Role } from "@/lib/roles";
import { SectionHeading } from "../ui/SectionHeading";
import { Reveal } from "../ui/Reveal";
import { JoinWaitlistLink } from "../JoinWaitlistButton";

const models: {
  icon: typeof Flame;
  name: string;
  forWho: string;
  how: string;
  gets: string[];
  role: Role;
  cta: string;
  featured?: boolean;
}[] = [
  {
    icon: Flame,
    name: "Release blitz",
    forWho: "Films, OTT shows and music launches",
    how: "A short, intense push around release day. Many clippers post at once so the feed is full of your title when it matters most.",
    gets: ["Trailer, song and scene cuts", "Heavy posting before and after release", "Daily focus on the reels that land"],
    role: "promoter",
    cta: "Plan a launch",
    featured: true,
  },
  {
    icon: Repeat,
    name: "Always-on",
    forWho: "Podcasts and creators who publish regularly",
    how: "Every new episode or video gets clipped, every week. Your back catalogue keeps working while you make the next one.",
    gets: ["Every episode turned into many reels", "A steady stream of new accounts posting", "Weekly verified view updates"],
    role: "creator",
    cta: "Start always-on",
  },
  {
    icon: Zap,
    name: "Moment spike",
    forWho: "Events, interviews and viral moments",
    how: "Fast turnaround on one big moment. We brief clippers quickly and ride the attention while it's still hot.",
    gets: ["Rapid brief and launch", "Many angles on the same moment", "A focused, short campaign window"],
    role: "creator",
    cta: "Talk about a moment",
  },
];

export function CampaignModels() {
  return (
    <section id="campaigns" className="section scroll-mt-16 bg-cream text-ink">
      <div className="container-site">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end lg:gap-16">
          <Reveal>
            <SectionHeading tone="light" eyebrow="Campaign models" line1="Three ways" line2="to run a campaign." />
          </Reveal>
          <Reveal>
            <p className="text-muted-light md:text-lg">
              Pick the shape that fits your content. Every model runs on the same rules: verified clippers, reviewed
              reels, and you pay only for verified views.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {models.map(({ icon: Icon, name, forWho, how, gets, role, cta, featured }, i) => (
            <Reveal key={name} delay={i * 0.06} className="h-full">
              <article
                className={`flex h-full flex-col rounded-3xl border p-7 transition-colors duration-300 md:p-9 ${
                  featured ? "border-ink bg-ink text-cream" : "border-ink bg-paper hover:border-olive"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`grid h-14 w-14 place-items-center rounded-2xl ${featured ? "bg-lime text-ink" : "bg-ink text-lime"}`}
                  >
                    <Icon size={26} aria-hidden />
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ${
                      featured ? "bg-lime text-ink" : "border border-ink text-ink"
                    }`}
                  >
                    Pay per verified view
                  </span>
                </div>

                <h3 className="mt-6 font-display text-3xl font-bold uppercase leading-none md:text-4xl">{name}</h3>
                <p className={`mt-2 font-serif text-[22px] italic leading-tight ${featured ? "text-lime" : "text-olive"}`}>
                  {forWho}
                </p>

                <p className={`mt-6 font-mono text-[11px] uppercase tracking-[0.16em] ${featured ? "text-muted-dark" : "text-muted-light"}`}>
                  How it works
                </p>
                <p className={`mt-2 ${featured ? "text-muted-dark" : "text-muted-light"}`}>{how}</p>

                <p className={`mt-6 font-mono text-[11px] uppercase tracking-[0.16em] ${featured ? "text-muted-dark" : "text-muted-light"}`}>
                  What you get
                </p>
                <ul className="mt-3 flex-1 space-y-2.5">
                  {gets.map((g) => (
                    <li key={g} className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                          featured ? "bg-lime text-ink" : "bg-ink text-lime"
                        }`}
                      >
                        <Check size={12} strokeWidth={3} aria-hidden />
                      </span>
                      <span className="text-sm font-medium md:text-base">{g}</span>
                    </li>
                  ))}
                </ul>

                <JoinWaitlistLink
                  role={role}
                  className={`group mt-8 inline-flex items-center gap-2 self-start rounded-full px-5 py-2.5 text-sm font-bold transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                    featured
                      ? "bg-lime text-ink focus-visible:ring-lime focus-visible:ring-offset-ink"
                      : "border border-ink text-ink hover:bg-ink hover:text-cream focus-visible:ring-ink focus-visible:ring-offset-cream"
                  }`}
                >
                  {cta} <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </JoinWaitlistLink>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
