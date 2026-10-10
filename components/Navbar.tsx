"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { JoinWaitlistButton } from "./JoinWaitlistButton";

const links = [
  { href: "#why-clipping", label: "Why clipping" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#automation", label: "Automation" },
  { href: "#team", label: "Team" },
  { href: "#contact", label: "Contact" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = scrolled || menuOpen;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        solid ? "border-b border-line bg-ink/85 backdrop-blur-md" : "border-b border-transparent bg-transparent",
      )}
    >
      <nav className="container-site flex h-16 items-center justify-between gap-4 md:h-20" aria-label="Main">
        <a href="#top" className="font-display text-2xl font-bold uppercase tracking-wide text-cream">
          ClipCrew
        </a>

        <ul className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="text-sm font-medium text-muted-dark transition hover:text-lime">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <JoinWaitlistButton size="sm" className="md:px-7 md:py-3 md:text-base" />
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full border border-line text-cream md:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <ul id="mobile-menu" className="container-site flex flex-col gap-1 pb-5 md:hidden">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-xl px-3 py-3 font-mono text-sm uppercase tracking-[0.14em] text-cream hover:bg-ink-2 hover:text-lime"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
