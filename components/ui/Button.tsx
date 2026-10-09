import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ink";
type Tone = "dark" | "light";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-bold transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60";

const sizes = {
  md: "px-7 py-3.5 text-base",
  sm: "px-5 py-2.5 text-sm",
  lg: "px-9 py-4 text-lg",
};

export function buttonClass({
  variant = "primary",
  tone = "dark",
  size = "md",
  className,
}: { variant?: Variant; tone?: Tone; size?: keyof typeof sizes; className?: string } = {}) {
  return cn(
    base,
    sizes[size],
    variant === "primary" && "bg-lime text-ink hover:shadow-lime focus-visible:ring-offset-ink",
    variant === "ink" && "bg-ink text-lime hover:shadow-[0_8px_32px_rgba(17,17,20,0.35)] focus-visible:ring-ink",
    variant === "secondary" &&
      (tone === "dark"
        ? "border border-cream/80 text-cream hover:border-lime hover:text-lime focus-visible:ring-offset-ink"
        : "border border-ink text-ink hover:bg-ink hover:text-cream"),
    className,
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  tone?: Tone;
  size?: keyof typeof sizes;
};

export function Button({ variant, tone, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass({ variant, tone, size, className })} {...props} />;
}
