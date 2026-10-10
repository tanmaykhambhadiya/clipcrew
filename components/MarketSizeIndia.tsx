"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { SectionHeading } from "./ui/SectionHeading";
import { Reveal } from "./ui/Reveal";

const rows = [
  {
    value: "₹10,000 Cr",
    label: "TAM · All creator marketing",
    text: "India's total spend on creator-led marketing, incl. direct brand–creator deals.",
  },
  {
    value: "₹5,000 Cr",
    label: "SAM · Organised campaigns, 2027",
    text: "Budgets run through platforms and agencies: ₹3,500 cr today, growing 22% a year.",
  },
  {
    value: "₹50 Cr",
    label: "SOM · Our 3-year target",
    text: "1% of the 2027 organised market: podcasts, creators, film and OTT launches.",
    highlight: true,
  },
];

// Concentric circles, all sitting on the same baseline. Size = % of container width.
const circles = [
  { label: "TAM", size: 100, cls: "bg-ink text-cream", labelTop: "9%" },
  { label: "SAM", size: 66, cls: "bg-olive text-cream", labelTop: "13%" },
  { label: "SOM", size: 30, cls: "bg-lime text-ink shadow-[0_0_48px_rgba(200,240,74,0.65)]", labelTop: "38%" },
];

function Circles() {
  const reduce = useReducedMotion();
  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[440px]"
      role="img"
      aria-label="Concentric circles: TAM ₹10,000 crore contains SAM ₹5,000 crore, which contains SOM ₹50 crore"
    >
      {circles.map((c, i) => (
        <motion.div
          key={c.label}
          className={cn("absolute bottom-0 rounded-full", c.cls)}
          style={{ width: `${c.size}%`, height: `${c.size}%`, left: `${(100 - c.size) / 2}%`, transformOrigin: "50% 100%" }}
          initial={reduce ? false : { scale: 0, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: i * 0.18 }}
        >
          <span
            className="absolute inset-x-0 text-center font-mono text-xs font-semibold uppercase tracking-[0.2em] md:text-sm"
            style={{ top: c.labelTop }}
          >
            {c.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

export function MarketSizeIndia() {
  return (
    <section className="section bg-cream text-ink">
      <div className="container-site">
        <Reveal>
          <SectionHeading
            tone="light"
            eyebrow="Market size · India"
            line1="₹10,000 Cr spent on creators."
            line2="We start with our slice."
          />
        </Reveal>

        <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-end lg:gap-16">
          <Circles />

          <Reveal>
            <ul className="border-t border-ink/80">
              {rows.map((r) => (
                <li key={r.label} className="border-b border-ink/80 py-6">
                  <p className="font-display text-[44px] font-bold leading-none md:text-[56px]">
                    <span className={cn(r.highlight && "rounded-lg bg-lime px-2 shadow-[0_0_32px_rgba(200,240,74,0.5)]")}>
                      {r.value}
                    </span>
                  </p>
                  <p className="mt-3 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-olive md:text-sm">
                    {r.label}
                  </p>
                  <p className="mt-2 text-muted-light md:text-lg">{r.text}</p>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal>
          <p className="mt-10 rounded-2xl bg-ink px-6 py-5 text-cream">
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-lime md:text-sm">
              Who&apos;s in it:
            </span>{" "}
            ~2 lakh earning creators · 40K+ podcasts · 274 streaming originals a year · 60–70% of films use creators
          </p>
        </Reveal>

        <p className="source-line text-muted-light">
          Sources: KlugKlug (Dec 2025) · Kofluence (2025) · BCG · Ormax · Qoruz · SOM: our estimate
        </p>
      </div>
    </section>
  );
}
