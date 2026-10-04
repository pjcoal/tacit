import { Reveal } from "@/components/ui/reveal";
import { Section, SectionHeader } from "@/components/ui/section";
import { ConvergeFlow } from "./converge-flow";

export function ModelsSection() {
  return (
    <Section id="models">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 [&>*]:min-w-0">
        <SectionHeader
          index="02"
          eyebrow="Auto"
          title={
            <>
              Every question.
              <br />
              <span className="text-ink-2">One quiet route.</span>
            </>
          }
          lead="However tangled the question, it takes the same path: personal details are stripped on your device, the request is answered, and the real values are put back before you read it. You never pick an engine — Auto handles that."
        />
        <Reveal delay={0.1}>
          <ConvergeFlow />
        </Reveal>
      </div>
    </Section>
  );
}
