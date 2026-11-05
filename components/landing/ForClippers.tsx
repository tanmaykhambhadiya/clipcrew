import { BadgeCheck, Bell, CalendarCheck, IndianRupee, LogIn, Wallet } from "lucide-react";
import Link from "next/link";
import { SectionHeading } from "../ui/SectionHeading";
import { Reveal } from "../ui/Reveal";
import { buttonClass } from "../ui/Button";
import { JoinWaitlistButton } from "../JoinWaitlistButton";

const perks = [
  { icon: IndianRupee, title: "Earn per verified view", text: "Each campaign has its own rate. The more real views your reels get, the more you earn." },
  { icon: CalendarCheck, title: "Weekly view updates", text: "Your verified views are updated every week, campaign by campaign and account by account." },
  { icon: Wallet, title: "A wallet you can read", text: "Earnings, fines and payouts in one place. Payouts go straight to your UPI ID." },
  { icon: BadgeCheck, title: "Verified accounts", text: "Add your pages once, prove they're yours with a bio code, then use them across campaigns." },
  { icon: Bell, title: "Know when a reel is rejected", text: "If a reel misses the brief you get a notification with the reason, so you can fix it fast." },
];

// Illustrative values only, for the mock wallet card.
const sampleWeeks = [
  { week: "Week 1", views: "48K", h: 30 },
  { week: "Week 2", views: "92K", h: 55 },
  { week: "Week 3", views: "71K", h: 44 },
  { week: "Week 4", views: "1.3L", h: 80 },
];

function WalletMock() {
  return (
    <div className="mx-auto w-full max-w-[360px]">
      <div
        className="rounded-[36px] border-2 border-lime bg-ink-2 p-3 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
        role="img"
        aria-label="Illustration of the ClipCrew clipper app: wallet balance, weekly verified views and a reel-rejected notification"
      >
        <div className="rounded-[28px] bg-ink p-5">
          <div className="mx-auto mb-5 h-1.5 w-14 rounded-full bg-line" aria-hidden />
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-dark">Wallet balance</p>
          <p className="mt-1 font-display text-4xl font-bold text-cream">₹3,840</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { l: "Earned", v: "₹4,200" },
              { l: "Fines", v: "−₹360" },
              { l: "Paid", v: "₹0" },
            ].map((x) => (
              <div key={x.l} className="rounded-xl border border-line bg-ink-2 px-2 py-2">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-dark">{x.l}</p>
                <p className="mt-0.5 text-sm font-semibold text-cream">{x.v}</p>
              </div>
            ))}
          </div>

          <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-dark">Verified views</p>
          <div className="mt-3 flex h-24 items-end gap-3">
            {sampleWeeks.map((w, i) => (
              <div key={w.week} className="flex flex-1 flex-col items-center gap-1">
                <span className="font-mono text-[9px] text-cream">{w.views}</span>
                <span
                  className={`w-full rounded-t-md ${i === sampleWeeks.length - 1 ? "bg-lime" : "bg-line"}`}
                  style={{ height: w.h }}
                />
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-line bg-ink-2 p-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red-500/15 text-red-300">
              <Bell size={14} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-cream">Reel rejected</p>
              <p className="text-xs text-muted-dark">Missing the brand caption. Fix and repost.</p>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-muted-dark/70">
        Illustration · sample numbers
      </p>
    </div>
  );
}

export function ForClippers() {
  return (
    <section id="for-clippers" className="section scroll-mt-16 bg-ink bg-glow text-cream">
      <div className="container-site">
        <div className="grid gap-14 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-16">
          <div className="min-w-0">
            <Reveal>
              <SectionHeading eyebrow="For clippers" line1="Clip it. Post it." line2="Get paid per verified view." />
            </Reveal>
            <Reveal>
              <p className="mt-6 max-w-xl text-muted-dark md:text-lg">
                Got pages with real followers and an eye for a good moment? Join the ClipCrew network, pick up campaigns
                and see exactly what you&apos;ve earned, every week.
              </p>
            </Reveal>

            <ul className="mt-10 space-y-5">
              {perks.map(({ icon: Icon, title, text }, i) => (
                <Reveal as="li" key={title} delay={i * 0.05} className="flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-line bg-ink-2 text-lime">
                    <Icon size={20} aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-serif text-[22px] italic leading-tight md:text-[26px]">{title}</h3>
                    <p className="mt-1 text-sm text-muted-dark md:text-base">{text}</p>
                  </div>
                </Reveal>
              ))}
            </ul>

            <Reveal>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <JoinWaitlistButton role="clipper">Become a clipper</JoinWaitlistButton>
                <Link href="/login" className={buttonClass({ variant: "secondary" })}>
                  <LogIn size={18} aria-hidden /> Clipper login
                </Link>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <WalletMock />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
