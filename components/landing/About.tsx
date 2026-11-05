import { BadgeCheck, CalendarCheck, Clapperboard, Mic, MonitorPlay, Radio, ScanEye, Ticket } from "lucide-react";
import { SectionHeading } from "../ui/SectionHeading";
import { Reveal } from "../ui/Reveal";

const sources = [
  { icon: Mic, label: "Podcasts" },
  { icon: MonitorPlay, label: "YouTube videos" },
  { icon: Radio, label: "Live streams" },
  { icon: Clapperboard, label: "Film trailers" },
  { icon: Ticket, label: "Events" },
];

const checks = [
  { icon: BadgeCheck, title: "Verified accounts", text: "Every clipper proves they own their page with a code in their bio." },
  { icon: ScanEye, title: "Every reel reviewed", text: "Our team checks each reel against your brief before it counts." },
  { icon: CalendarCheck, title: "Views checked weekly", text: "Views are verified every week before anyone gets paid." },
];

const sampleReels = [
  { name: "Reel · the hot take", status: "Approved", ok: true },
  { name: "Reel · story moment", status: "Approved", ok: true },
  { name: "Reel · off-brief audio", status: "Rejected", ok: false },
];

function VerifyCard() {
  return (
    <div
      className="rounded-3xl border border-line bg-ink-2 p-6 md:p-8"
      role="img"
      aria-label="Illustration: a clipper account verified with a code in its bio, and reels approved or rejected after review"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-dark">Account check</p>
      <div className="mt-4 flex items-center gap-4 rounded-2xl border border-line bg-ink p-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-lime font-display text-lg font-bold text-ink">
          @
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-cream">@clips.daily</p>
          <p className="truncate font-mono text-[11px] text-muted-dark">bio: &ldquo;&hellip; CC-7Q2K&rdquo;</p>
        </div>
        <span className="shrink-0 rounded-full bg-lime px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink">
          Verified
        </span>
      </div>

      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-dark">Reel review</p>
      <ul className="mt-4 space-y-2">
        {sampleReels.map((r) => (
          <li key={r.name} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-ink px-4 py-3">
            <span className="truncate text-sm text-cream">{r.name}</span>
            <span
              className={`shrink-0 rounded-full px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] ${
                r.ok ? "bg-lime/15 text-lime" : "bg-red-500/15 text-red-300"
              }`}
            >
              {r.status}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-dark/70">Illustration</p>
    </div>
  );
}

export function About() {
  return (
    <section id="about" className="section scroll-mt-16 bg-ink text-cream">
      <div className="container-site">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16">
          <div className="min-w-0">
            <Reveal>
              <SectionHeading eyebrow="About ClipCrew" line1="A clipping company." line2="Built for the feed." />
            </Reveal>
            <Reveal>
              <p className="mt-7 text-base leading-relaxed text-muted-dark md:text-lg">
                ClipCrew takes the long content you already make and turns it into short, native clips. Our clipper
                network posts them on Instagram Reels, YouTube Shorts, TikTok, X and Facebook, from many different
                accounts, so your best moments reach people who have never heard of you.
              </p>
              <p className="mt-4 text-base leading-relaxed text-muted-dark md:text-lg">
                And it&apos;s run with care: verified clipper accounts, a human look at every reel, and views checked every
                week before a single rupee is paid out.
              </p>
            </Reveal>
            <Reveal>
              <p className="mt-8 font-mono text-xs uppercase tracking-[0.18em] text-lime">{"//"} What we clip</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {sources.map(({ icon: Icon, label }) => (
                  <li key={label} className="inline-flex items-center gap-2 rounded-full border border-line bg-ink-2 px-4 py-2 text-sm">
                    <Icon size={16} className="text-lime" aria-hidden /> {label}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <Reveal delay={0.1} className="min-w-0">
            <VerifyCard />
          </Reveal>
        </div>

        <ul className="mt-14 grid gap-5 md:grid-cols-3">
          {checks.map(({ icon: Icon, title, text }, i) => (
            <Reveal
              as="li"
              key={title}
              delay={i * 0.06}
              className="rounded-3xl border border-line bg-ink-2 p-7 transition-colors duration-300 hover:border-lime"
            >
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-lime text-ink">
                <Icon size={22} aria-hidden />
              </span>
              <h3 className="mt-5 font-serif text-[26px] italic leading-tight">{title}</h3>
              <p className="mt-2 text-muted-dark">{text}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
