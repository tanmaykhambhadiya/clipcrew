import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SectionHeading } from "./ui/SectionHeading";

export function LegalPage({ line1, line2, children }: { line1: string; line2: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-cream text-ink">
      <div className="container-site max-w-3xl py-20 md:py-28">
        <Link href="/" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-olive hover:text-ink">
          <ArrowLeft size={14} /> Back to ClipCrew
        </Link>
        <SectionHeading as="h1" tone="light" className="mt-8" line1={line1} line2={line2} />
        <div className="mt-10 space-y-5 text-muted-light md:text-lg [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:uppercase [&_h2]:text-ink">
          {children}
        </div>
        <p className="mt-14 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-light">Last updated: placeholder — replace before launch.</p>
      </div>
    </main>
  );
}
