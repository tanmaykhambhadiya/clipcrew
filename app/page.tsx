import { Automation } from "@/components/Automation";
import { FinalCTA } from "@/components/FinalCTA";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { Market } from "@/components/Market";
import { Navbar } from "@/components/Navbar";
import { Platform } from "@/components/Platform";
import { Problem } from "@/components/Problem";
import { Proof } from "@/components/Proof";
import { TrackRecord } from "@/components/TrackRecord";
import { WaitlistProvider } from "@/components/WaitlistProvider";
import { WhoItsFor } from "@/components/WhoItsFor";

export default function Home() {
  return (
    <WaitlistProvider>
      <Navbar />
      <main>
        <Hero />
        <Problem />
        <Proof />
        <Market />
        <HowItWorks />
        <WhoItsFor />
        <Automation />
        <Platform />
        <TrackRecord />
        <FinalCTA />
      </main>
      <Footer />
    </WaitlistProvider>
  );
}
