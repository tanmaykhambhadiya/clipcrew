import { ArrowDown, Play } from "lucide-react";
import { buttonClass } from "./ui/Button";
import { ReelFrame } from "./ui/ReelFrame";
import { StatNumber } from "./ui/StatNumber";
import { JoinWaitlistButton } from "./JoinWaitlistButton";

const proof = [
  { value: 25, suffix: "M", text: "views a month at our peak" },
  { value: 5, suffix: "", text: "reels past 1M views" },
  { value: 15, suffix: "", text: "accounts run by our team" },
  { value: 25, prefix: "~", suffix: "", text: "clippers in the community" },
];

function ProofStrip() {
  return (
    <ul className="mt-16 grid grid-cols-2 gap-3 md:mt-20 lg:grid-cols-4 lg:gap-5" aria-label="ClipCrew track record">
      {proof.map((p) => (
        <li
          key={p.text}
          className="rounded-3xl border border-line border-t-4 border-t-lime bg-ink-2/80 p-5 backdrop-blur-sm transition-colors duration-300 hover:border-lime md:p-7"
        >
          <StatNumber
            value={p.value}
            prefix={p.prefix}
            suffix={p.suffix}
            className="block font-display text-[40px] font-bold leading-none text-cream md:text-[56px]"
          />
          <p className="mt-2 text-sm text-muted-dark md:text-base">{p.text}</p>
        </li>
      ))}
    </ul>
  );
}

function ReelStack() {
  return (
    <div
      className="relative mx-auto h-[340px] w-[300px] sm:h-[420px] sm:w-[360px] lg:h-[520px] lg:w-[440px]"
      role="img"
      aria-label="Three fanned vertical reel frames, the front one showing 2M+ views"
    >
      {/* back frames */}
      <div className="absolute left-[42%] top-[6%] w-[44%] animate-float [animation-delay:-4s]">
        <ReelFrame className="rotate-[14deg] bg-ink-2/80">
          <div className="absolute inset-x-4 bottom-6 space-y-2">
            <div className="h-2 w-3/4 rounded-full bg-line" />
            <div className="h-2 w-1/2 rounded-full bg-line" />
          </div>
        </ReelFrame>
      </div>
      <div className="absolute left-[28%] top-[3%] w-[46%] animate-float [animation-delay:-2s]">
        <ReelFrame className="rotate-[6deg]">
          <div className="absolute inset-x-4 bottom-6 space-y-2">
            <div className="h-2 w-2/3 rounded-full bg-line" />
            <div className="h-2 w-1/3 rounded-full bg-line" />
          </div>
        </ReelFrame>
      </div>

      {/* front frame */}
      <div className="absolute left-[6%] top-0 w-[50%] animate-float">
        <ReelFrame className="-rotate-3 bg-[linear-gradient(160deg,#23281A_0%,#1C1C21_60%)]">
          <p className="absolute inset-x-0 top-4 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-cream/80 sm:text-xs">
            Reel 01 / 100
          </p>
          <div className="absolute inset-0 grid place-items-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-lime text-ink sm:h-16 sm:w-16">
              <Play size={26} fill="currentColor" className="translate-x-0.5" />
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-5 flex justify-center">
            <span className="rounded-full bg-lime px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink sm:text-xs">
              2M+ views
            </span>
          </div>
        </ReelFrame>
      </div>

      {/* sticker */}
      <div className="absolute bottom-[4%] right-[4%] grid h-20 w-20 -rotate-12 place-items-center rounded-full bg-lime font-display text-3xl font-bold text-ink shadow-lime sm:h-24 sm:w-24 sm:text-4xl">
        ×100
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-ink bg-glow pb-20 pt-28 md:pb-28 md:pt-40">
      <div className="container-site grid items-center gap-14 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <p className="eyebrow mb-6 text-lime">{"//"} The short-form growth engine</p>
          <h1>
            <span className="block font-display text-[64px] font-bold uppercase leading-none tracking-tight text-cream sm:text-[96px] lg:text-[128px]">
              ClipCrew
            </span>
            <span className="mt-3 block font-serif text-[36px] italic leading-[1.05] text-cream md:text-[56px]">
              One video in.
            </span>
            <span className="block font-serif text-[36px] italic leading-[1.05] text-lime md:text-[56px]">
              A hundred reels out.
            </span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-relaxed text-muted-dark md:text-lg">
            Your content, working harder. We turn podcasts, videos, streams and trailers into hundreds of native clips,
            posted by a trained network of verified clippers. You pay only for views we&apos;ve verified.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <JoinWaitlistButton role="creator">Start a campaign</JoinWaitlistButton>
            <a href="#how-it-works" className={buttonClass({ variant: "secondary" })}>
              See how it works <ArrowDown size={18} />
            </a>
          </div>
          <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark/80 md:text-xs">
            Reels · Shorts · TikTok · X · Facebook
          </p>
        </div>

        <ReelStack />
      </div>
      <div className="container-site">
        <ProofStrip />
      </div>
    </section>
  );
}
