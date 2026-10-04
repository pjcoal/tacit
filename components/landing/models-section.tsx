import { Shuffle } from "lucide-react";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import { Section, SectionHeader } from "@/components/ui/section";
import { publicChatModels } from "@/lib/ai/registry";
import { env } from "@/server/env";

/** Availability comes from this deployment's configured provider keys — nothing is implied that isn't wired up. */
export function ModelsSection() {
  const e = env();
  const models = publicChatModels(e.CREDITS_PER_USD, e.PRICE_MARKUP_BPS).filter((m) => m.id !== "auto");
  const families = [...new Set(models.map((m) => m.family))];
  const anyAvailable = models.some((m) => m.available);

  return (
    <Section id="models">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 [&>*]:min-w-0">
        <SectionHeader
          index="02"
          eyebrow="Models"
          title={
            <>
              Many models.
              <br />
              One private layer.
            </>
          }
          lead={
            <>
              Pick a model or let <span className="font-medium text-ink">Auto</span> route by task. Every request — whichever
              provider answers it — passes through the same filter, the same receipts and the same local history.
            </>
          }
        />
        <Reveal delay={0.1} className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <span className="flex items-center gap-2 text-[14px] font-medium">
              <Shuffle size={15} className="text-dim" /> Auto
            </span>
            <span className="text-[12.5px] text-dim">Routes to a configured model by prompt size, images and tools</span>
          </div>
          <ul className="divide-y divide-line-2">
            {families.map((f) => {
              const fm = models.filter((m) => m.family === f);
              return (
                <li key={f} className="grid grid-cols-[110px_1fr] gap-4 px-5 py-3.5 sm:grid-cols-[140px_1fr]">
                  <span className="flex items-center gap-2.5 text-[14px] font-medium">
                    <span className="grid h-6 w-6 place-items-center rounded-md border border-line bg-bg font-serif text-[14px]">{f[0]}</span>
                    {f}
                  </span>
                  <span className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {fm.map((m) => (
                      <span key={m.id} className="inline-flex items-center gap-1.5 text-[13px] text-ink-2" title={m.available ? `${m.label} via ${m.providerLabel}` : m.unavailableReason ?? undefined}>
                        <StatusDot tone={m.available ? "mint" : "dim"} />
                        <span className={m.available ? "" : "text-dim"}>{m.label}</span>
                        {m.free ? <span className="font-mono text-[10px] uppercase text-dim">free</span> : null}
                      </span>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line bg-sunken px-5 py-3 text-[12px] text-dim">
            <span className="inline-flex items-center gap-1.5">
              <StatusDot tone="mint" /> Available on this deployment
            </span>
            <span className="inline-flex items-center gap-1.5">
              <StatusDot tone="dim" /> Provider not configured
            </span>
            {!anyAvailable ? <Badge tone="amber">Setup required</Badge> : null}
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
