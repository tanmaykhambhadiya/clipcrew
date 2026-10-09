import { Play } from "lucide-react";
import { cn } from "@/lib/cn";
import { SectionHeading } from "./ui/SectionHeading";
import { Reveal } from "./ui/Reveal";

type Row = { big: string; text: string };

const global: Row[] = [
  { big: "50M", text: "creators — only ~4% earn $100K+" },
  { big: "$480B", text: "creator economy by 2027" },
  { big: "584M", text: "podcast listeners" },
];

const india: Row[] = [
  { big: "2–2.5M", text: "creators — only 8–10% earn meaningfully" },
  { big: "$350–400B", text: "consumer spend influenced by creators" },
  { big: "~120M", text: "podcast listeners" },
];

function MarketCard({ title, rows, dark }: { title: string; rows: Row[]; dark?: boolean }) {
  return (
    <div
      className={cn(
        "h-full rounded-3xl border p-7 transition-colors duration-300 hover:border-lime md:p-10",
        dark ? "border-line bg-ink text-cream" : "border-ink bg-paper text-ink",
      )}
    >
      <h3 className={cn("font-mono text-sm uppercase tracking-[0.2em]", dark ? "text-lime" : "text-olive")}>{title}</h3>
      <ul className="mt-6 space-y-6">
        {rows.map((r) => (
          <li key={r.big} className={cn("border-t pt-5", dark ? "border-line" : "border-ink/20")}>
            <p className={cn("font-display text-[44px] font-bold leading-none md:text-[56px]", dark && "text-lime")}>{r.big}</p>
            <p className={cn("mt-2", dark ? "text-muted-dark" : "text-muted-light")}>{r.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Market() {
  return (
    <section className="section bg-cream text-ink">
      <div className="container-site">
        <Reveal>
          <SectionHeading tone="light" eyebrow="The market" line1="Millions of creators." line2="Not enough distribution." />
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          <Reveal>
            <MarketCard title="Global" rows={global} dark />
          </Reveal>
          <Reveal delay={0.1}>
            <MarketCard title="India" rows={india} />
          </Reveal>
        </div>

        <Reveal>
          <p className="mt-5 flex items-start gap-3 rounded-2xl bg-ink px-6 py-5 text-cream">
            <Play size={18} className="mt-1 shrink-0 text-lime" fill="currentColor" aria-hidden />
            <span>
              <span className="font-bold text-lime">Film &amp; OTT:</span> ₹250 cr spent on creator-led film promotion in
              India in 2025, used by 60–70% of releases.
            </span>
          </p>
        </Reveal>

        <p className="source-line text-muted-light">
          Sources: Goldman Sachs · BCG (2025) · eMarketer · Astute Analytica · Qoruz
        </p>
      </div>
    </section>
  );
}
