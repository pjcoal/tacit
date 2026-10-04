import { Shuffle } from "lucide-react";
import { StatusDot } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import { Section, SectionHeader } from "@/components/ui/section";
import { publicChatModels } from "@/lib/ai/registry";
import { env } from "@/server/env";

/** Lists only the models that are live on this deployment — the ones Auto can route to. */
export function ModelsSection() {
  const e = env();
  const live = publicChatModels(e.CREDITS_PER_USD, e.PRICE_MARKUP_BPS).filter((m) => m.id !== "auto" && m.available);
  const families = [...new Set(live.map((m) => m.family))];

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
        <Reveal delay={0.1} className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
            <span className="flex items-center gap-2 text-[15px] font-medium">
              <Shuffle size={15} className="text-dim" /> Auto
            </span>
            <span className="text-[12.5px] text-dim">Routes each request by size, images and complexity</span>
          </div>
          {families.length ? (
            <>
              <p className="eyebrow px-5 pt-4">Currently routing to</p>
              <ul className="divide-y divide-line-2">
                {families.map((f) => (
                  <li key={f} className="grid grid-cols-[110px_1fr] gap-4 px-5 py-3.5 sm:grid-cols-[140px_1fr]">
                    <span className="flex items-center gap-2.5 text-[14px] font-medium">
                      <span className="grid h-6 w-6 place-items-center rounded-md border border-line bg-bg font-serif text-[14px]">{f[0]}</span>
                      {f}
                    </span>
                    <span className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {live
                        .filter((m) => m.family === f)
                        .map((m) => (
                          <span key={m.id} className="inline-flex items-center gap-1.5 text-[13px] text-ink-2">
                            <StatusDot tone="mint" /> {m.label}
                          </span>
                        ))}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <p className="border-t border-line bg-sunken px-5 py-3 text-[12px] text-dim">More model families are added to Auto as they come online.</p>
        </Reveal>
      </div>
    </Section>
  );
}
