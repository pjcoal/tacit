import { CreditsSection } from "@/components/landing/credits-section";
import { Hero } from "@/components/landing/hero";
import { ModelsSection } from "@/components/landing/models-section";
import { Nav } from "@/components/landing/nav";
import { Pricing } from "@/components/landing/pricing";
import { PrivacyDemo } from "@/components/landing/privacy-demo";
import { AppSection, ApiSection, CodeSection, ConnectorSection, FinalCta, Footer, PrivacyBoundary, Solutions } from "@/components/landing/sections";
import { Showcase } from "@/components/landing/showcase";
import { TokenSection } from "@/components/landing/token-section";
import { Section, SectionHeader } from "@/components/ui/section";
import { getPublicConfig } from "@/server/public-config";

export default function Home() {
  const cfg = getPublicConfig();
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-bg">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />

        <Section id="privacy">
          <SectionHeader
            index="01"
            eyebrow="Smart privacy"
            title={
              <>
                Personal context goes in.
                <br />
                <span className="text-ink-2">An anonymous request comes out.</span>
              </>
            }
            lead="Before anything is sent, the composer finds names, places, contact details, IDs, card numbers and wallet addresses and swaps them for stable placeholders. The model answers in placeholders; your browser puts the real values back."
          />
          <div className="mt-12">
            <PrivacyDemo />
          </div>
        </Section>

        <ModelsSection />

        <Section id="products">
          <SectionHeader index="03" eyebrow="Products" title="Chat, image, video, connect, code." lead="Five tools behind the same privacy layer and the same credits." />
          <div className="mt-12">
            <Showcase />
          </div>
        </Section>

        <Solutions />
        <AppSection />
        <CodeSection />
        <PrivacyBoundary />
        <ConnectorSection />

        <Section id="pay">
          <SectionHeader
            index="09"
            eyebrow="Credits"
            title={
              <>
                Fund once.
                <br />
                Spend quietly.
              </>
            }
            lead="Credits are bought with a single wallet transfer and verified on-chain by our server — not by a success message in your browser. They sit on a pseudonymous account with no email attached."
          />
          <div className="mt-12">
            <CreditsSection />
          </div>
        </Section>

        <Section id="token">
          <SectionHeader
            index="10"
            eyebrow={`$${cfg.token.symbol} token`}
            title={
              <>
                Usage flows in.
                <br />
                <span className="text-ink-2">Supply flows out.</span>
              </>
            }
            lead={`$${cfg.token.symbol} launches on pump.fun and trades on its bonding curve, then on PumpSwap after graduation. Paying for credits with it earns a bonus today; buyback and burn are proposed utility, and labelled that way until they're live.`}
          />
          <div className="mt-12">
            <TokenSection />
          </div>
        </Section>

        <ApiSection />

        <Section id="plans">
          <SectionHeader index="12" eyebrow="Plans" title="Every model. One private plan." lead="Start free with no account. Plans add credits and higher limits for a fixed period, paid with one wallet transaction." />
          <div className="mt-12">
            <Pricing />
          </div>
        </Section>

        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
