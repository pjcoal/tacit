import { Reveal } from "@/components/ui/reveal";
import { Section, SectionHeader } from "@/components/ui/section";
import { VeilScan } from "./veil-scan";

export function ModelsSection() {
  return (
    <Section id="models">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 [&>*]:min-w-0">
        <SectionHeader
          index="02"
          eyebrow="Auto"
          title={
            <>
              Paste the real thing.
              <br />
              <span className="text-ink-2">Only placeholders leave.</span>
            </>
          }
          lead="Logs, keys, customer emails, wallet addresses: paste them as they are. Veil swaps each one for a placeholder before anything leaves your device, Auto routes the request to the right model for the job, and the real values come back only on your screen."
        />
        <Reveal delay={0.1}>
          <VeilScan />
        </Reveal>
      </div>
    </Section>
  );
}
