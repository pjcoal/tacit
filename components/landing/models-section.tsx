import { Reveal } from "@/components/ui/reveal";
import { Section, SectionHeader } from "@/components/ui/section";
import { publicChatModels } from "@/lib/ai/registry";
import { env } from "@/server/env";
import { ModelOrbit } from "./model-orbit";

/** Lists only the models that are live on this deployment — the ones Auto can route to. */
export function ModelsSection() {
  const e = env();
  const live = publicChatModels(e.CREDITS_PER_USD, e.PRICE_MARKUP_BPS).filter((m) => m.id !== "auto" && m.available);

  return (
    <Section id="models">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 [&>*]:min-w-0">
        <SectionHeader
          index="02"
          eyebrow="Models"
          title={
            <>
              One question.
              <br />
              The right model.
            </>
          }
          lead={
            <>
              You don&apos;t pick a model — <span className="font-medium text-ink">Auto</span> does, based on how long and complex your
              request is and whether it includes images. Whichever model answers, the request passes through the same filter, the same
              receipts and the same local history.
            </>
          }
        />
        <Reveal delay={0.1} className="flex flex-col items-center justify-center">
          <ModelOrbit models={live.map((m) => m.label)} />
          <p className="mt-4 text-center text-[12.5px] text-dim">Requests arrive, pass the privacy filter, and Auto sends each one to the model best suited to it.</p>
        </Reveal>
      </div>
    </Section>
  );
}
