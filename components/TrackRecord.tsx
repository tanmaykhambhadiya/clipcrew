import { StatNumber } from "./ui/StatNumber";
import { Reveal } from "./ui/Reveal";

const tiles = [
  { value: 2, suffix: " MO", text: "live campaign, run by hand" },
  { value: 25, suffix: "M", text: "views a month at our peak" },
  { value: 5, suffix: " × 1M+", text: "reels past 1M views" },
  { value: 15, suffix: "", text: "accounts run by a 5-person team" },
];

/** ClipCrew's real track-record numbers, used inside the credibility (Team) section on a cream background. */
export function TrackRecord() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
      {tiles.map((t, i) => (
        <Reveal
          as="li"
          key={t.text}
          delay={i * 0.06}
          className="rounded-3xl border border-ink border-t-4 bg-paper p-7 transition-colors duration-300 hover:border-olive"
        >
          <StatNumber
            value={t.value}
            suffix={t.suffix}
            className="block font-display text-[44px] font-bold leading-none text-ink md:text-[56px]"
          />
          <p className="mt-3 text-muted-light">{t.text}</p>
        </Reveal>
      ))}
    </ul>
  );
}
