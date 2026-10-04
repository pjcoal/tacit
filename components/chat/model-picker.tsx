"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Eye, Shuffle, Wrench } from "lucide-react";
import type { PublicModel } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

export function ModelPicker({
  models,
  value,
  onChange,
  hasCredits,
}: {
  models: PublicModel[] | null;
  value: string;
  onChange: (id: string) => void;
  hasCredits: boolean;
}) {
  const current = models?.find((m) => m.id === value);
  const families = models ? [...new Set(models.filter((m) => m.id !== "auto").map((m) => m.family))] : [];

  return (
    <DM.Root>
      <DM.Trigger
        className="inline-flex h-8 max-w-[180px] items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12.5px] font-medium outline-none hover:border-ink/30 data-[state=open]:border-ink/30"
        data-testid="model-picker"
      >
        {value === "auto" ? <Shuffle size={13} className="text-dim" /> : null}
        <span className="truncate">{current?.label ?? (models ? value : "Loading…")}</span>
        <ChevronDown size={13} className="shrink-0 text-dim" />
      </DM.Trigger>
      <DM.Portal>
        <DM.Content
          side="top"
          align="start"
          sideOffset={8}
          className="scrollbar-thin z-[70] max-h-[min(460px,70dvh)] w-[300px] overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)]"
        >
          {!models ? <div className="p-3 text-[13px] text-dim">Loading models…</div> : null}
          {models?.filter((m) => m.id === "auto").map((m) => (
            <Item key={m.id} m={m} selected={value === m.id} onSelect={onChange} hasCredits={hasCredits} />
          ))}
          {families.map((f) => (
            <DM.Group key={f}>
              <DM.Label className="eyebrow px-2.5 pt-3 pb-1">{f}</DM.Label>
              {models!
                .filter((m) => m.family === f)
                .map((m) => (
                  <Item key={m.id} m={m} selected={value === m.id} onSelect={onChange} hasCredits={hasCredits} />
                ))}
            </DM.Group>
          ))}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

function Item({ m, selected, onSelect, hasCredits }: { m: PublicModel; selected: boolean; onSelect: (id: string) => void; hasCredits: boolean }) {
  const needsCredits = !m.free && !hasCredits && m.id !== "auto";
  return (
    <DM.Item
      disabled={!m.available}
      onSelect={() => onSelect(m.id)}
      className="flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45 data-[highlighted]:bg-sunken"
    >
      <span className="mt-0.5 w-3.5 shrink-0">{selected ? <Check size={14} /> : null}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[13.5px] font-medium">
          {m.label}
          {m.vision ? <Eye size={11} className="text-dim" aria-label="Reads images" /> : null}
          {m.tools ? <Wrench size={11} className="text-dim" aria-label="Supports tools" /> : null}
        </span>
        <span className={cn("block text-[11.5px]", m.available ? "text-dim" : "text-amber")}>
          {!m.available
            ? m.unavailableReason
            : m.id === "auto"
              ? "Picks a configured model for each message"
              : `${m.providerLabel}${m.free ? " · free tier" : needsCredits ? " · needs credits" : ""}`}
        </span>
      </span>
    </DM.Item>
  );
}
