import { SectionHeading } from "./ui/SectionHeading";
import { Reveal } from "./ui/Reveal";
import { JoinWaitlistButton } from "./JoinWaitlistButton";

export function FinalCTA() {
  return (
    <section className="section bg-lime text-ink">
      <Reveal className="container-site flex flex-col items-center text-center">
        <SectionHeading tone="lime" align="center" line1="Be first in line." line2="Your next 100 reels start here." />
        <JoinWaitlistButton variant="ink" size="lg" className="mt-10" />
        <p className="mt-5 text-sm font-medium text-ink/75">Early members get priority onboarding.</p>
      </Reveal>
    </section>
  );
}
