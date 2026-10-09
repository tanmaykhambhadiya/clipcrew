import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy — ClipCrew" };

export default function PrivacyPage() {
  return (
    <LegalPage line1="Privacy" line2="What we collect and why.">
      <p>This is a placeholder privacy policy. Replace it with your final policy before launch.</p>
      <h2>What we collect</h2>
      <p>
        When you join the waitlist we store your role, name, email and any optional details you choose to share
        (WhatsApp number, social handle, audience size, release date or clipping experience). When you use the contact
        form we store your name, email and message.
      </p>
      <h2>How we use it</h2>
      <p>Only to contact you about ClipCrew early access and to reply to your messages. We don&apos;t sell your data.</p>
      <h2>Your choices</h2>
      <p>Email us at info@ignitralabs.com to see, change or delete what we hold about you.</p>
    </LegalPage>
  );
}
