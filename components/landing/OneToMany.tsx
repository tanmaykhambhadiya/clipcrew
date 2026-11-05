import { ArrowRight, Play } from "lucide-react";
import { SectionHeading } from "../ui/SectionHeading";
import { Reveal } from "../ui/Reveal";
import { PlatformChips } from "./PlatformChips";

// Each output reel takes a different hook, angle or audience.
const reels = [
  { kind: "Hook", label: "The hot take" },
  { kind: "Angle", label: "Story moment" },
  { kind: "Audience", label: "Hindi captions" },
  { kind: "Hook", label: "Did you know?" },
  { kind: "Angle", label: "Behind the scenes" },
  { kind: "Audience", label: "Gen Z cut" },
  { kind: "Hook", label: "The punchline" },
  { kind: "Angle", label: "Quick tip" },
  { kind: "Audience", label: "Fan edit" },
];

// Fake waveform heights (px); lime bars mark the moments worth clipping.
const BARS = [6, 10, 7, 14, 9, 18, 12, 8, 16, 22, 11, 7, 13, 20, 9, 6, 12, 17, 8, 10];
const HIGHLIGHTS = new Set([5, 9, 13]);

function FlowArrow() {
  return (
    <div className="flex justify-center text-olive" aria-hidden>
      <ArrowRight size={28} className="rotate-90 lg:rotate-0" />
    </div>
  );
}

function LongVideo() {
  return (
    <div className="flex h-full flex-col rounded-3xl border border-ink bg-ink p-6 text-cream">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-dark">Input</p>
      <div className="mt-4 grid aspect-video place-items-center rounded-2xl border border-line bg-ink-2">
        <span className="grid h-12 w-12 place-items-center rounded-full border border-cream/40">
          <Play size={20} fill="currentColor" className="translate-x-0.5" />
        </span>
      </div>
      <div className="mt-4 flex h-6 items-end gap-[3px]">
        {BARS.map((h, i) => (
          <span key={i} className={`flex-1 rounded-sm ${HIGHLIGHTS.has(i) ? "bg-lime" : "bg-line"}`} style={{ height: h }} />
        ))}
      </div>
      <p className="mt-4 font-display text-2xl font-bold uppercase">1 long video</p>
      <p className="text-sm text-muted-dark">Podcast, stream, trailer or event</p>
    </div>
  );
}

function Engine() {
  return (
    <div className="flex h-full flex-col justify-center rounded-3xl bg-lime p-6 text-center text-ink">
      <span className="font-display text-3xl font-bold uppercase">ClipCrew</span>
      <span className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em]">Clippers + automation</span>
      <ul className="mt-5 space-y-1.5 text-left text-sm font-medium">
        {["Find the moments", "Cut native reels", "Test many hooks", "Review every reel"].map((t) => (
          <li key={t} className="rounded-full bg-ink/10 px-3 py-1.5">
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReelGrid() {
  return (
    <div className="flex h-full flex-col rounded-3xl border border-ink bg-ink p-5 text-cream md:p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-lime">Output</p>
      <ul className="mt-4 grid grid-cols-3 gap-2">
        {reels.map((r) => (
          <li
            key={r.label}
            className="relative flex aspect-[9/16] flex-col justify-between overflow-hidden rounded-xl border border-lime/60 bg-[linear-gradient(170deg,#23281A_0%,#1C1C21_70%)] p-2"
          >
            <span className="self-start rounded-full bg-lime px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.1em] text-ink sm:text-[9px]">
              {r.kind}
            </span>
            <span className="text-[10px] font-medium leading-tight text-cream sm:text-xs">{r.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 font-display text-2xl font-bold uppercase text-lime">100s of native reels</p>
    </div>
  );
}

export function OneToMany() {
  return (
    <section className="section bg-cream text-ink">
      <div className="container-site">
        <Reveal>
          <SectionHeading tone="light" eyebrow="The idea" line1="One asset." line2="Becomes many." />
        </Reveal>
        <Reveal>
          <p className="mt-6 max-w-2xl text-muted-light md:text-lg">
            A single episode hides dozens of moments worth sharing. We cut each one a few different ways, so every reel
            speaks to a different viewer, and the feed tells us which ones win.
          </p>
        </Reveal>

        <Reveal>
          <div
            className="mt-12 grid items-stretch gap-4 lg:grid-cols-[1fr_auto_0.9fr_auto_1.2fr]"
            role="img"
            aria-label="One long video goes into ClipCrew, where clippers and automation turn it into hundreds of reels, each with a different hook, angle or audience"
          >
            <LongVideo />
            <FlowArrow />
            <Engine />
            <FlowArrow />
            <ReelGrid />
          </div>
        </Reveal>

        <Reveal>
          <div className="mt-10 flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
            <p className="shrink-0 font-mono text-xs uppercase tracking-[0.18em] text-olive">{"//"} Posted natively to</p>
            <PlatformChips tone="light" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
