import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "mint" | "amber" | "danger" | "panel";

const tones: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-2 border-line",
  accent: "bg-accent-soft text-accent-ink border-accent-line",
  mint: "bg-mint-soft text-mint border-transparent",
  amber: "bg-amber-soft text-amber border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
  panel: "bg-white/6 text-panel-dim border-panel-line",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2.5 font-mono text-[10.5px] uppercase tracking-[0.06em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusDot({ tone }: { tone: "mint" | "amber" | "dim" | "danger" | "accent" }) {
  const color = { mint: "bg-mint", amber: "bg-amber", dim: "bg-faint", danger: "bg-danger", accent: "bg-accent" }[tone];
  return <span className={cn("dot", color)} aria-hidden="true" />;
}
