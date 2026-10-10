import { ArrowRight, ShieldCheck, Sparkles, Users } from "lucide-react";
import { SectionHeading } from "./ui/SectionHeading";
import { Reveal } from "./ui/Reveal";

const fixes = [
  { icon: Users, text: "Hundreds of clippers post the best moments on their own pages." },
  { icon: Sparkles, text: "Fresh clips every day reach people who never followed you." },
  { icon: ShieldCheck, text: "Clippers are paid per verified view, often cheaper than ads." },
];

function SameFollowersVisual() {
  return (
    <figure className="mt-8 rounded-2xl border border-line bg-ink p-5">
      <div className="flex items-center justify-center gap-4 sm:gap-6" aria-hidden>
        <div className="relative aspect-[9/16] w-12 rounded-[10px] border-2 border-cream/60">
          <span className="absolute left-1/2 top-1.5 h-1 w-4 -translate-x-1/2 rounded-full bg-cream/40" />
        </div>
        <ArrowRight size={28} className="shrink-0 text-[#6B6B72]" />
        <div className="grid h-20 w-20 place-items-center rounded-full border-2 border-dashed border-[#6B6B72] text-muted-dark">
          <Users size={28} />
        </div>
      </div>
      <figcaption className="mt-4 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-muted-dark">
        1 account → the same followers, every time
      </figcaption>
    </figure>
  );
}

export function WhyClipping() {
  return (
    <section id="why-clipping" className="section scroll-mt-16 bg-ink bg-glow text-cream">
      <div className="container-site">
        <Reveal>
          <SectionHeading eyebrow="Why clipping exists" line1="Long videos don't travel." line2="Clips do." />
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          <Reveal className="h-full">
            <article className="flex h-full flex-col rounded-3xl border border-line bg-ink-2 p-7 transition-colors duration-300 hover:border-lime md:p-10">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-dark md:text-sm">The problem</p>
              <h3 className="mt-4 font-serif text-[26px] italic leading-tight md:text-[32px]">
                Creators make long videos. Audiences scroll short ones.
              </h3>
              <p className="mt-4 text-muted-dark md:text-lg">
                A 60-minute podcast, stream or trailer has to be cut into reels to be seen. And one account posting 2–3
                reels a day only reaches the people who already follow it.
              </p>
              <div className="mt-auto">
                <SameFollowersVisual />
              </div>
            </article>
          </Reveal>

          <Reveal delay={0.1} className="h-full">
            <article className="flex h-full flex-col rounded-3xl bg-lime p-7 text-ink md:p-10">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-ink/70 md:text-sm">
                The fix: clipping
              </p>
              <h3 className="mt-4 font-serif text-[26px] italic leading-tight md:text-[32px]">
                Many accounts. Many clips. New audiences.
              </h3>
              <ul className="mt-6 space-y-4">
                {fixes.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink text-lime">
                      <Icon size={20} aria-hidden />
                    </span>
                    <span className="pt-2 font-medium md:text-lg">{text}</span>
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>
        </div>

        <p className="source-line text-muted-dark">
          Clipping CPMs ~$1–6 vs ~$7–12 for Reels/TikTok ads (industry benchmarks, 2026)
        </p>
      </div>
    </section>
  );
}
