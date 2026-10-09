import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms — ClipCrew" };

export default function TermsPage() {
  return (
    <LegalPage line1="Terms" line2="The simple version.">
      <p>This is a placeholder terms page. Replace it with your final terms before launch.</p>
      <h2>The waitlist</h2>
      <p>
        Joining the waitlist doesn&apos;t create a contract or guarantee access. We&apos;ll reach out as we open up
        early access.
      </p>
      <h2>Content on this site</h2>
      <p>
        Statistics are taken from the public sources listed on each section. Product previews use illustrative data.
      </p>
      <h2>Contact</h2>
      <p>Questions? Email hello@clipcrew.in.</p>
    </LegalPage>
  );
}
