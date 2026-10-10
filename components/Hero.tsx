import { ArrowDown, Play } from "lucide-react";
import { buttonClass } from "./ui/Button";
import { ReelFrame } from "./ui/ReelFrame";
import { JoinWaitlistButton } from "./JoinWaitlistButton";

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
            We turn your podcasts, videos and film trailers into hundreds of reels — made by a trained clipper network
            and our own automation.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <JoinWaitlistButton />
            <a href="#how-it-works" className={buttonClass({ variant: "secondary" })}>
              See how it works <ArrowDown size={18} />
            </a>
          </div>
          <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark/80 md:text-xs">
            25M views a month at peak · 5 reels past 1M views
          </p>
        </div>

        <ReelStack />
      </div>
    </section>
  );
}
