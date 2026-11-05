import { SectionHeading } from "./ui/SectionHeading";
import { Reveal } from "./ui/Reveal";
import { JoinWaitlistButton } from "./JoinWaitlistButton";

export function FinalCTA() {
  return (
    <section className="section bg-lime text-ink">
      <Reveal className="container-site flex flex-col items-center text-center">
        <SectionHeading
          tone="lime"
          align="center"
          eyebrow="Ready when you are"
          line1="Got content worth clipping?"
          line2="Let's put it to work."
        />
        <p className="mt-6 max-w-xl font-medium text-ink/80 md:text-lg">
          Brands, studios, podcasters and creators: tell us what you&apos;re launching. Clippers: join the crew and get
          paid for every verified view.
        </p>
        <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <JoinWaitlistButton role="creator" variant="ink" size="lg">
            Let&apos;s talk
          </JoinWaitlistButton>
          <JoinWaitlistButton role="clipper" variant="secondary" tone="light" size="lg">
            Become a clipper
          </JoinWaitlistButton>
        </div>
        <p className="mt-5 text-sm font-medium text-ink/75">Early members get priority onboarding.</p>
      </Reveal>
    </section>
  );
}
