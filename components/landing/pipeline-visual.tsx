"use client";

import { m, useInView } from "framer-motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useEffect, useRef, useState } from "react";
import { WithOriginals, WithPlaceholders } from "@/components/privacy/highlight";
import { cn } from "@/lib/utils";

export interface PipelineData {
  original: string;
  sanitized: string;
  replacements: Array<{ placeholder: string; type: string; value: string }>;
  modelReply: string;
  restored: string;
}

const STAGES = [
  { key: "raw", label: "Raw prompt", where: "Your device" },
  { key: "filter", label: "Privacy filter", where: "Your device" },
  { key: "anon", label: "Anonymized prompt", where: "Leaves device" },
  { key: "model", label: "Model", where: "Provider" },
  { key: "restore", label: "Local restoration", where: "Your device" },
] as const;

function StageBody({ stage, data }: { stage: (typeof STAGES)[number]["key"]; data: PipelineData }) {
  switch (stage) {
    case "raw":
      return <WithOriginals text={data.original} values={data.replacements.map((r) => r.value)} />;
    case "filter":
      return (
        <ul className="space-y-1.5 font-mono text-[11.5px] leading-snug">
          {data.replacements.map((r) => (
            <li key={r.placeholder} className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span className="text-dim">{r.type.toLowerCase()}</span>
              <span className="truncate text-ink-2 line-through decoration-faint">{r.value}</span>
              <span aria-hidden className="text-dim">→</span>
              <span className="chip-ph">{r.placeholder}</span>
            </li>
          ))}
        </ul>
      );
    case "anon":
      return <WithPlaceholders text={data.sanitized} />;
    case "model":
      return (
        <>
          <WithPlaceholders text={data.modelReply} />
          <span className="mt-2 block font-mono text-[10.5px] uppercase tracking-wider text-dim">Example reply</span>
        </>
      );
    case "restore":
      return <WithOriginals text={data.restored} values={data.replacements.map((r) => r.value)} />;
  }
}

export function PipelineVisual({ data }: { data: PipelineData }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-80px" });
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;
    const t = setInterval(() => setActive((a) => (a + 1) % STAGES.length), 2400);
    return () => clearInterval(t);
  }, [inView, reduce]);

  return (
    <div ref={ref} className="relative">
      {/* progress rail (desktop) */}
      <div aria-hidden className="absolute inset-x-[10%] top-[18px] hidden h-px bg-line lg:block">
        <m.div
          className="absolute left-0 top-0 h-px bg-ink"
          animate={{ width: `${(active / (STAGES.length - 1)) * 100}%` }}
          transition={{ duration: reduce ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <ol className="relative grid gap-3 lg:grid-cols-5 lg:gap-4">
        {STAGES.map((s, i) => {
          const isActive = reduce || i === active;
          const leaves = s.key === "anon" || s.key === "model";
          return (
            <li key={s.key} className="relative">
              <button
                type="button"
                onClick={() => setActive(i)}
                className="mb-3 hidden w-full items-center justify-center lg:flex"
                aria-label={`Show stage ${i + 1}: ${s.label}`}
              >
                <span
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-full border font-mono text-[11px] transition-colors duration-500",
                    i <= active || reduce ? "border-ink bg-ink text-bg" : "border-line bg-bg text-dim",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
              </button>
              <m.div
                animate={{ y: isActive && !reduce ? -4 : 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "card relative h-full p-4 transition-[border-color,box-shadow] duration-500 lg:min-h-[208px]",
                  isActive ? "border-ink/40 shadow-[var(--shadow-pop)]" : "",
                  leaves && "bg-sunken",
                )}
              >
                <div className="flex items-center justify-between gap-2 lg:block">
                  <span className="eyebrow block !text-ink">
                    <span className="mr-1.5 text-dim lg:hidden">{String(i + 1).padStart(2, "0")}</span>
                    {s.label}
                  </span>
                  <span className={cn("font-mono text-[10px] uppercase tracking-wider lg:mt-1 lg:block", leaves ? "text-accent-ink" : "text-mint")}>{s.where}</span>
                </div>
                <div className="mt-3 text-[13.5px] leading-relaxed text-ink">
                  <StageBody stage={s.key} data={data} />
                </div>
              </m.div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
