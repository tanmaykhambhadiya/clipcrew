import Link from "next/link";
import { InstagramIcon, LinkedInIcon } from "./ui/SocialIcons";
import { ContactForm } from "./ContactForm";

const EMAIL = "info@ignitralabs.com";
const socials = [
  { href: "https://www.instagram.com/ignitralabs/", label: "Ignitra Labs on Instagram", icon: InstagramIcon },
  { href: "https://www.linkedin.com/in/tanmaykhambhadiya/", label: "Tanmay Khambhadiya on LinkedIn", icon: LinkedInIcon },
];

export function Footer() {
  return (
    <footer id="contact" className="scroll-mt-16 border-t border-line bg-ink text-cream">
      <div className="container-site grid gap-12 py-16 md:grid-cols-[1fr_auto] md:gap-16 md:py-20">
        <div>
          <p className="font-display text-4xl font-bold uppercase">ClipCrew</p>
          <p className="mt-2 font-serif text-2xl italic text-lime">One video in. A hundred reels out.</p>
          <a href={`mailto:${EMAIL}`} className="mt-6 inline-block text-muted-dark underline-offset-4 hover:text-lime hover:underline">
            {EMAIL}
          </a>
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
            <Link href="/privacy" className="hover:text-lime">Privacy</Link>
            <Link href="/terms" className="hover:text-lime">Terms</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
