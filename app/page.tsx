import { Automation } from "@/components/Automation";
import { FinalCTA } from "@/components/FinalCTA";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { About } from "@/components/landing/About";
import { BrandSafety } from "@/components/landing/BrandSafety";
import { CampaignModels } from "@/components/landing/CampaignModels";
import { FAQ } from "@/components/landing/FAQ";
import { ForClippers } from "@/components/landing/ForClippers";
import { OneToMany } from "@/components/landing/OneToMany";
import { Market } from "@/components/Market";
import { MarketSizeIndia } from "@/components/MarketSizeIndia";
import { Navbar } from "@/components/Navbar";
import { Platform } from "@/components/Platform";
import { Problem } from "@/components/Problem";
import { Proof } from "@/components/Proof";
import { Team } from "@/components/Team";
import { WaitlistProvider } from "@/components/WaitlistProvider";
import { WhyClipping } from "@/components/WhyClipping";

// Sections alternate ink / cream backgrounds in this order — keep that rhythm when reordering.
export default function Home() {
  return (
    <WaitlistProvider>
      <Navbar />
      <main>
        <Hero />
        <OneToMany />
        <About />
        <Team />
        <HowItWorks />
        <CampaignModels />
        <BrandSafety />
        <Problem />
        <WhyClipping />
        <Market />
        <Proof />
        <MarketSizeIndia />
        <Automation />
        <Platform />
        <ForClippers />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </WaitlistProvider>
  );
}
