"use client";

import { m, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

const CAPABILITIES = ["Chat", "Reasoning", "Vision", "Code", "Solana", "Writing", "Research", "Translate"];

const OUTER_R = 40; // % of stage
const MID_R = 26;

function polar(angleDeg: number, r: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) };
}

/**
 * The Auto router as a slow orbit: requests travel in from an outer ring of
 * capabilities, pass the privacy filter at the core, and go out to whichever
 * live model is answering.
 */
export function ModelOrbit({ models }: { models: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-80px" });
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const live = models.length ? models : ["Auto"];

  useEffect(() => {
    if (!inView || reduce) return;
    const t = setInterval(() => setStep((s) => s + 1), 3200);
    return () => clearInterval(t);
  }, [inView, reduce]);

  const capAngles = CAPABILITIES.map((_, i) => (360 / CAPABILITIES.length) * i - 90);
  const modelAngles = live.map((_, i) => (360 / live.length) * i + (live.length === 2 ? 0 : -90));
  const activeCap = step % CAPABILITIES.length;
  const activeModel = step % live.length;
  const inbound = polar(capAngles[activeCap], OUTER_R);
  const outbound = polar(modelAngles[activeModel], MID_R);
  const spin = !reduce;

  return (
    <div ref={ref} className="relative mx-auto aspect-square w-full max-w-[540px] overflow-hidden select-none" aria-hidden>
      {/* Static rings */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <circle cx="50" cy="50" r={OUTER_R} fill="none" stroke="var(--line)" strokeWidth="0.25" strokeDasharray="0.6 1.4" />
        <circle cx="50" cy="50" r={MID_R} fill="none" stroke="var(--line)" strokeWidth="0.25" />
        <circle cx="50" cy="50" r="13" fill="none" stroke="var(--accent-line)" strokeWidth="0.3" strokeDasharray="0.4 0.9" />
      </svg>

      {/* Outer ring: capabilities (slow clockwise) */}
      <div className={cn("absolute inset-0", spin && "animate-[orbit_160s_linear_infinite]")}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible">
          {capAngles.map((a, i) => {
            const p = polar(a, OUTER_R);
            return <line key={i} x1="50" y1="50" x2={p.x} y2={p.y} stroke="var(--line-2)" strokeWidth="0.2" />;
          })}
          {!reduce ? (
            <m.circle
              key={`in-${step}`}
              r="0.9"
              fill="var(--ink)"
              initial={{ cx: inbound.x, cy: inbound.y, opacity: 0 }}
              animate={{ cx: 50, cy: 50, opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.3, ease: [0.4, 0, 0.2, 1] }}
            />
          ) : null}
        </svg>
        {CAPABILITIES.map((c, i) => {
          const p = polar(capAngles[i], OUTER_R);
          const active = !reduce && i === activeCap;
          return (
            <div key={c} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
              <span
                className={cn(
                  "block rounded-md border px-1.5 py-0.5 font-mono text-[9.5px] whitespace-nowrap sm:px-2 transition-colors duration-500 sm:text-[11.5px]",
                  spin && "animate-[orbit_160s_linear_infinite_reverse]",
                  active ? "border-ink/40 bg-surface text-ink" : "border-line bg-bg text-dim",
                )}
              >
                {c}
              </span>
            </div>
          );
        })}
      </div>

      {/* Middle ring: live models (counter-clockwise) */}
      <div className={cn("absolute inset-0", spin && "animate-[orbit_110s_linear_infinite_reverse]")}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible">
          {modelAngles.map((a, i) => {
            const p = polar(a, MID_R);
            return <line key={i} x1="50" y1="50" x2={p.x} y2={p.y} stroke="var(--line)" strokeWidth="0.25" />;
          })}
          {!reduce ? (
            <m.circle
              key={`out-${step}`}
              r="1"
              fill="var(--mint)"
              initial={{ cx: 50, cy: 50, opacity: 0 }}
              animate={{ cx: outbound.x, cy: outbound.y, opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.1, delay: 1.5, ease: [0.4, 0, 0.2, 1] }}
            />
          ) : null}
        </svg>
        {live.map((label, i) => {
          const p = polar(modelAngles[i], MID_R);
          const active = !reduce && i === activeModel;
          return (
            <div key={label} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium whitespace-nowrap sm:px-3 sm:py-1 transition-[background,border-color,box-shadow] duration-500 sm:text-[12.5px]",
                  spin && "animate-[orbit_110s_linear_infinite]",
                  active ? "border-mint/50 bg-surface shadow-[0_0_0_4px_var(--mint-soft)]" : "border-line bg-surface",
                )}
              >
                <span className={cn("dot", active ? "bg-mint" : "bg-faint")} />
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Core: privacy filter + router */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        {!reduce ? (
          <m.span
            key={`pulse-${step}`}
            className="absolute inset-0 rounded-full border border-accent"
            initial={{ scale: 1, opacity: 0 }}
            animate={{ scale: [1, 1.9], opacity: [0, 0.5, 0] }}
            transition={{ duration: 1.2, delay: 1.2, ease: "easeOut" }}
          />
        ) : null}
        <div className="relative grid h-[70px] w-[70px] place-items-center rounded-full border border-line bg-surface shadow-[var(--shadow-pop)] sm:h-[104px] sm:w-[104px]">
          <div className="flex flex-col items-center gap-1">
            <LogoMark size={20} className="text-ink" />
            <span className="text-[13px] font-semibold">Auto</span>
            <span className="font-mono text-[9px] tracking-wider text-accent-ink uppercase">filtered</span>
          </div>
        </div>
      </div>
    </div>
  );
}
