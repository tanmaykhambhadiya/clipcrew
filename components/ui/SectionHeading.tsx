import { cn } from "@/lib/cn";

type Props = {
  eyebrow?: string;
  line1: string;
  line2: string;
  tone?: "dark" | "light" | "lime";
  as?: "h1" | "h2" | "h3";
  align?: "left" | "center";
  className?: string;
};

export function SectionHeading({ eyebrow, line1, line2, tone = "dark", as: Tag = "h2", align = "left", className }: Props) {
  const accent = tone === "dark" ? "text-lime" : tone === "light" ? "text-olive" : "text-ink";
  const main = tone === "dark" ? "text-cream" : "text-ink";

  return (
    <div className={cn(align === "center" && "text-center", className)}>
      {eyebrow && <p className={cn("eyebrow mb-5", tone === "lime" ? "text-ink/70" : accent)}>{"//"} {eyebrow}</p>}
      <Tag className="text-[40px] leading-[1.02] md:text-[64px]">
        <span className={cn("block font-display font-bold uppercase", main)}>{line1}</span>
        <span className={cn("block font-serif italic leading-[1.05]", accent)}>{line2}</span>
      </Tag>
    </div>
  );
}
