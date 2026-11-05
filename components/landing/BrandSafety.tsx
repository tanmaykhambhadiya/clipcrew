import { BadgeCheck, CalendarCheck, Check, FolderLock, ScanEye } from "lucide-react";
import { SectionHeading } from "../ui/SectionHeading";
import { Reveal } from "../ui/Reveal";

const controls = [
  {
    icon: BadgeCheck,
    title: "Verified accounts only",
    text: "Clippers add a one-time code to their bio so we know the page is theirs. Unverified accounts can't join your campaign.",
    tag: "Code-in-bio check",
  },
  {
    icon: FolderLock,
    title: "Your footage, your rules",
    text: "You decide what footage is used, which platforms it goes on and what's off-limits. The brief travels with every campaign.",
    tag: "Brief & asset approval",
  },
  {
    icon: ScanEye,
    title: "Human review of every reel",
    text: "Our team looks at every reel. Off-brief reels are rejected and their views don't count; repeat rule-breakers are fined.",
    tag: "Manual review",
  },
  {
    icon: CalendarCheck,
    title: "Views verified before payout",
    text: "Views are checked every week before anyone is paid. Suspicious spikes are held back, so you never pay for fake views.",
    tag: "Weekly verification",
  },
];

const pipeline = ["Reel posted", "Checked against brief", "Views verified", "Clipper paid"];

export function BrandSafety() {
  return (
    <section id="brand-safety" className="section scroll-mt-16 bg-ink text-cream">
      <div className="container-site">
        <Reveal>
          <SectionHeading eyebrow="Brand safety" line1="Brand safety &" line2="campaign control." />
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {controls.map(({ icon: Icon, title, text, tag }, i) => (
            <Reveal key={title} delay={i * 0.06} className="h-full">
              <article className="flex h-full flex-col rounded-3xl border border-line bg-ink-2 p-7 transition-colors duration-300 hover:border-lime md:p-9">
                <div className="flex items-center justify-between gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-lime text-ink">
                    <Icon size={22} aria-hidden />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-dark md:text-[11px]">{tag}</span>
                </div>
                <h3 className="mt-6 font-serif text-[26px] italic leading-tight md:text-[32px]">{title}</h3>
                <p className="mt-3 text-muted-dark md:text-lg">{text}</p>
              </article>
            </Reveal>
          ))}
        </div>

        {/* Every post verified */}
        <Reveal>
          <div className="mt-5 rounded-3xl border-2 border-lime p-7 md:p-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:items-center">
              <div>
                <p className="eyebrow text-lime">{"//"} Every post verified</p>
                <p className="mt-4 font-display text-3xl font-bold uppercase leading-none md:text-5xl">No check,</p>
                <p className="font-serif text-3xl italic leading-tight text-lime md:text-5xl">no payout.</p>
                <p className="mt-4 text-muted-dark">
                  A reel only earns once it has passed every step. That keeps clippers honest and your budget on real
                  viewers.
                </p>
              </div>
              <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {pipeline.map((p, i) => (
                  <li key={p} className="flex items-center gap-3 rounded-2xl border border-line bg-ink-2 p-4 lg:flex-col lg:items-start">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lime text-ink">
                      <Check size={16} strokeWidth={3} aria-hidden />
                    </span>
                    <span>
                      <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-dark">Step {i + 1}</span>
                      <span className="block font-medium">{p}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
