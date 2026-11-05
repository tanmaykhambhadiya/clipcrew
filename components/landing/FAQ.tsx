"use client";

import { Plus } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { SectionHeading } from "../ui/SectionHeading";
import { Reveal } from "../ui/Reveal";

const faqs = [
  {
    q: "What is a clipping campaign?",
    a: "You give us long content, like a podcast, video, stream or trailer. Our network of clippers cuts it into short, native reels and posts them on their own pages. Instead of one account posting a few reels, many accounts post many angles, so your content reaches people who don't follow you yet.",
  },
  {
    q: "Where do the clips get posted?",
    a: "On short-form feeds: Instagram Reels, YouTube Shorts, TikTok, X and Facebook. For each campaign we agree which platforms are allowed, and clippers can only use accounts on those platforms.",
  },
  {
    q: "Who controls the footage?",
    a: "You do. You choose what footage we can use and what's off-limits, and the brief sets the rules for captions, tone and branding. Clippers only work with the material you approve for that campaign.",
  },
  {
    q: "How do clips stay on-brand?",
    a: "Every campaign has a written brief, and our team reviews every reel against it. Reels that miss the brief are rejected, the clipper is told why, and views on a rejected reel never count toward payment. Repeated rule-breaking leads to fines or removal.",
  },
  {
    q: "What about fake views and bots?",
    a: "Views are checked by hand every week before anyone is paid. Clipper accounts must be verified with a code in their bio, and suspicious numbers are held back. You pay for verified views only.",
  },
  {
    q: "What kind of content works best?",
    a: "Content with strong moments: opinions, stories, reactions, punchlines, reveals and useful tips. Podcasts, interviews, streams, film and OTT trailers, music launches and live events all clip well. If people would rewind it, it will probably clip.",
  },
  {
    q: "How do clippers get paid?",
    a: "Per verified view. Each campaign has its own rate, verified views are updated every week for each account, and earnings, any fines and payouts show up in the clipper's wallet. Payouts are sent to the clipper's UPI ID.",
  },
  {
    q: "How do I become a clipper?",
    a: "Tap \"Become a clipper\" and join the waitlist. Once you're onboarded you get a login, add your social accounts, verify them with a bio code, and start joining campaigns.",
  },
];

function Item({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  const id = useId();
  const btnId = `${id}-btn`;
  const panelId = `${id}-panel`;
  return (
    <li className="border-b border-ink/80">
      <h3>
        <button
          id={btnId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-6 py-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive focus-visible:ring-offset-4 focus-visible:ring-offset-cream"
        >
          <span className="font-serif text-[22px] italic leading-tight md:text-[28px]">{q}</span>
          <span
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink transition duration-300",
              open && "rotate-45 bg-ink text-lime",
            )}
            aria-hidden
          >
            <Plus size={18} />
          </span>
        </button>
      </h3>
      <div id={panelId} role="region" aria-labelledby={btnId} hidden={!open} className="pb-7 pr-2 md:pr-16">
        <p className="text-muted-light md:text-lg">{a}</p>
      </div>
    </li>
  );
}

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="section scroll-mt-16 bg-cream text-ink">
      <div className="container-site grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        <Reveal>
          <SectionHeading tone="light" eyebrow="FAQ" line1="Questions," line2="answered." />
          <p className="mt-6 max-w-sm text-muted-light">
            Anything else? Write to us from the form at the bottom of the page and we&apos;ll get back to you.
          </p>
        </Reveal>
        <ul className="border-t border-ink/80">
          {faqs.map((f, i) => (
            <Item key={f.q} q={f.q} a={f.a} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
          ))}
        </ul>
      </div>
    </section>
  );
}
