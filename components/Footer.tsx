import Link from "next/link";
import { InstagramIcon, LinkedInIcon } from "./ui/SocialIcons";
import { ContactForm } from "./ContactForm";

const EMAIL = "info@ignitralabs.com";
const SITE_DOMAIN = "clipcrew.ignitralabs.com";
const SITE_URL = `https://${SITE_DOMAIN}`;
const socials = [
  { href: "https://www.instagram.com/ignitralabs/", label: "Ignitra Labs on Instagram", icon: InstagramIcon },
  { href: "https://www.linkedin.com/in/tanmaykhambhadiya/", label: "Tanmay Khambhadiya on LinkedIn", icon: LinkedInIcon },
];
const quickLinks = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#campaigns", label: "Campaigns" },
  { href: "/#for-clippers", label: "For clippers" },
  { href: "/#faq", label: "FAQ" },
];

export function Footer() {
  return (
    <footer id="contact" className="scroll-mt-16 border-t border-line bg-ink text-cream">
      <div className="container-site grid gap-12 py-16 md:grid-cols-[1fr_auto] md:gap-16 md:py-20">
        <div>
          <p className="font-display text-4xl font-bold uppercase">ClipCrew</p>
          <p className="mt-2 font-serif text-2xl italic text-lime">One video in. A hundred reels out.</p>
          <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-dark">
            <a href={`mailto:${EMAIL}`} className="underline-offset-4 hover:text-lime hover:underline">
              {EMAIL}
            </a>
            <span aria-hidden className="text-muted-dark/50">·</span>
            <a href={SITE_URL} className="underline-offset-4 hover:text-lime hover:underline">
              {SITE_DOMAIN}
            </a>
          </p>
          <nav aria-label="Footer" className="mt-6">
            <ul className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs uppercase tracking-[0.14em] text-muted-dark">
              {quickLinks.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="hover:text-lime">
                    {l.label}
                  </a>
                </li>
              ))}
              <li>
                <Link href="/login" className="text-lime hover:underline">
                  Clipper login
                </Link>
              </li>
            </ul>
          </nav>
          <ul className="mt-6 flex gap-3">
            {socials.map(({ href, label, icon: Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid h-10 w-10 place-items-center rounded-full border border-line text-muted-dark transition hover:border-lime hover:text-lime"
                >
                  <Icon />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <ContactForm />
      </div>

      <div className="border-t border-line">
        <div className="container-site flex flex-wrap items-center justify-between gap-3 py-6 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-dark/80">
          <span>© 2026 ClipCrew</span>
          <nav aria-label="Legal" className="flex gap-5">
            <Link href="/login" className="hover:text-lime">Clipper login</Link>
            <Link href="/privacy" className="hover:text-lime">Privacy</Link>
            <Link href="/terms" className="hover:text-lime">Terms</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
