"use client";

import { m, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";

const W = 640;
const H = 380;
const CX = 330; // filter aperture
const CY = 190;
const DEST = W - 40;

// Deterministic "messy" inputs: each starts somewhere on the left and wanders into the aperture.
const INPUTS = Array.from({ length: 11 }, (_, i) => {
  const y0 = 28 + i * 32.4;
  const wob = ((i * 37) % 23) - 11;
  const c1 = { x: 70 + ((i * 53) % 40), y: y0 + wob * 3.2 };
  const c2 = { x: 190 + ((i * 29) % 50), y: CY + (y0 - CY) * 0.35 - wob * 2.4 };
  return { d: `M 0 ${y0} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${CX} ${CY}`, delay: (i * 0.37) % 2.2, dur: 2.6 + ((i * 7) % 5) * 0.25 };
});

const OUTPUT = `M ${CX} ${CY} L ${DEST - 18} ${CY}`;

/**
 * One cycle per detail: it rides its strand into the filter, is swapped,
 * and its placeholder rides the output line to the model. Details are
 * staggered by STEP so one arrives every STEP seconds.
 */
const CYCLE = 6;
const STEP = 2;
const IN_END = 0.44; // fraction of the cycle spent travelling in
const OUT_START = 0.48;
const OUT_END = 0.88;

const DETAILS = [
  { strand: 1, from: "maya@proton.me", to: "[EMAIL_1]" },
  { strand: 5, from: "New York", to: "[CITY_1]" },
  { strand: 9, from: "7xKX…sAsU", to: "[WALLET_1]" },
];

const chipW = (text: string) => text.length * 7.4 + 18;

function Chip({ text, tone }: { text: string; tone: "in" | "out" }) {
  const w = chipW(text);
  return (
    <>
      <rect
        x={-w / 2}
        y={-12}
        width={w}
        height="24"
        rx="7"
        fill={tone === "in" ? "var(--amber-soft)" : "var(--accent-soft)"}
        stroke={tone === "in" ? "var(--amber)" : "var(--accent-line)"}
        strokeOpacity={tone === "in" ? 0.5 : 1}
      />
      <text y="4.5" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill={tone === "in" ? "var(--ink)" : "var(--accent-ink)"}>
        {text}
      </text>
    </>
  );
}

/** Many tangled questions converge through one privacy filter and leave as a single calm path. */
export function ConvergeFlow() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduce = useReducedMotion();
  const play = inView && !reduce;
  const shown = inView || reduce;
  const kt = (...t: number[]) => t.join(";");

  return (
    <div ref={ref} className="relative -mx-2 w-[calc(100%+16px)] select-none sm:mx-0 sm:w-full" aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible">
        <defs>
          <linearGradient id="cf-fade" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="var(--ink)" stopOpacity="0" />
            <stop offset="0.4" stopColor="var(--ink)" stopOpacity="0.18" />
            <stop offset="1" stopColor="var(--ink)" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="cf-out-grad" x1={CX} x2={DEST} y1="0" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="1" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0.55" />
          </linearGradient>
          <radialGradient id="cf-glow">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.4" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="cf-scan" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
            <stop offset="0.5" stopColor="var(--accent)" stopOpacity="0.9" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
          <clipPath id="cf-pill">
            <rect x={CX - 9} y={CY - 46} width="18" height="92" rx="9" />
          </clipPath>
          {INPUTS.map((p, i) => (
            <path key={i} id={`cf-in-${i}`} d={p.d} />
          ))}
          <path id="cf-out-path" d={OUTPUT} />
        </defs>

        {/* Inputs: faint tangled strands, drawn in, with sparks flowing toward the filter */}
        {INPUTS.map((p, i) => (
          <g key={i}>
            <m.path
              d={p.d}
              fill="none"
              stroke="url(#cf-fade)"
              strokeWidth="1"
              initial={{ pathLength: reduce ? 1 : 0 }}
              animate={{ pathLength: shown ? 1 : 0 }}
              transition={{ duration: 1.4, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            />
            {play ? (
              <path
                d={p.d}
                fill="none"
                stroke="var(--ink)"
                strokeOpacity="0.55"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeDasharray="5 420"
                className="animate-[cf-flow_var(--d)_linear_infinite]"
                style={{ ["--d" as string]: `${p.dur}s`, animationDelay: `${p.delay + 1.2}s`, strokeDashoffset: 426 }}
              />
            ) : null}
          </g>
        ))}

        {/* Output: one calm, glowing line */}
        <m.path
          d={OUTPUT}
          fill="none"
          stroke="var(--accent)"
          strokeOpacity="0.18"
          strokeWidth="8"
          strokeLinecap="round"
          initial={{ pathLength: reduce ? 1 : 0 }}
          animate={{ pathLength: shown ? 1 : 0 }}
          transition={{ duration: 1.1, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
        <m.path
          d={OUTPUT}
          fill="none"
          stroke="url(#cf-out-grad)"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: reduce ? 1 : 0 }}
          animate={{ pathLength: shown ? 1 : 0 }}
          transition={{ duration: 1.1, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* The filter: glow, a flash each time a detail passes, and a scanning light */}
        <circle cx={CX} cy={CY} r="74" fill="url(#cf-glow)" />
        {play ? (
          <circle cx={CX} cy={CY} r="22" fill="none" stroke="var(--accent)" strokeWidth="1.2" opacity="0">
            <animate attributeName="r" values="22;70" dur={`${STEP}s`} begin={`${(IN_END * CYCLE) % STEP}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;0" dur={`${STEP}s`} begin={`${(IN_END * CYCLE) % STEP}s`} repeatCount="indefinite" />
          </circle>
        ) : null}
        <rect x={CX - 9} y={CY - 46} width="18" height="92" rx="9" fill="var(--surface)" stroke="var(--line)" />
        {[-28, -14, 0, 14, 28].map((dy, i) => (
          <rect key={dy} x={CX - 4.5} y={CY + dy - 2} width="9" height="4" rx="2" fill="var(--accent)" opacity={0.25 + (i % 2) * 0.35} />
        ))}
        {play ? (
          <g clipPath="url(#cf-pill)">
            <rect x={CX - 9} y={CY - 66} width="18" height="20" fill="url(#cf-scan)" opacity="0.8">
              <animate attributeName="y" values={`${CY - 66};${CY + 46};${CY - 66}`} dur="2.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" />
            </rect>
          </g>
        ) : null}

        {/* Destination: pulses as each clean placeholder arrives */}
        <m.g initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: shown ? 1 : 0, scale: 1 }} transition={{ delay: 1.9, duration: 0.5 }} style={{ transformOrigin: `${DEST}px ${CY}px` }}>
          {play ? (
            <circle cx={DEST} cy={CY} r="16" fill="none" stroke="var(--accent)" strokeWidth="1.2" opacity="0">
              <animate attributeName="r" values="16;40" dur={`${STEP}s`} begin={`${(OUT_END * CYCLE) % STEP}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0" dur={`${STEP}s`} begin={`${(OUT_END * CYCLE) % STEP}s`} repeatCount="indefinite" />
            </circle>
          ) : null}
          <circle cx={DEST} cy={CY} r="16" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.5" />
          <circle cx={DEST} cy={CY} r="5" fill="var(--accent)" />
        </m.g>

        {/* Details riding in, and their placeholders riding out */}
        {play
          ? DETAILS.map((d, i) => {
              const begin = `${1.6 + i * STEP}s`;
              const dur = `${CYCLE}s`;
              return (
                <g key={d.from}>
                  <g opacity="0">
                    <Chip text={d.from} tone="in" />
                    <animateMotion dur={dur} begin={begin} repeatCount="indefinite" keyPoints="0.16;0.84;0.84" keyTimes={kt(0, IN_END, 1)} calcMode="linear">
                      <mpath href={`#cf-in-${d.strand}`} />
                    </animateMotion>
                    <animate attributeName="opacity" values="0;1;1;0;0" keyTimes={kt(0, 0.06, IN_END - 0.06, IN_END, 1)} dur={dur} begin={begin} repeatCount="indefinite" />
                  </g>
                  <g opacity="0">
                    <Chip text={d.to} tone="out" />
                    <animateMotion dur={dur} begin={begin} repeatCount="indefinite" keyPoints="0.16;0.16;0.86;0.86" keyTimes={kt(0, OUT_START, OUT_END, 1)} calcMode="linear">
                      <mpath href="#cf-out-path" />
                    </animateMotion>
                    <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes={kt(0, OUT_START, OUT_START + 0.05, OUT_END - 0.07, OUT_END, 1)} dur={dur} begin={begin} repeatCount="indefinite" />
                  </g>
                </g>
              );
            })
          : null}

        {/* Reduced motion: a still frame of the same story */}
        {reduce
          ? DETAILS.map((d, i) => (
              <g key={d.from}>
                <g transform={`translate(${90 + (i % 2) * 30} ${70 + i * 120})`}>
                  <Chip text={d.from} tone="in" />
                </g>
                <g transform={`translate(${470} ${100 + i * 60 + (i > 0 ? 80 : 0)})`}>
                  <Chip text={d.to} tone="out" />
                </g>
              </g>
            ))
          : null}

        {/* Captions */}
        <g fontFamily="var(--font-mono)" fontSize="12" letterSpacing="1.2" fill="var(--dim)">
          <text x="0" y={H - 4}>YOUR QUESTIONS</text>
          <text x={CX} y={H - 4} textAnchor="middle">
            PRIVACY FILTER
          </text>
          <text x={W} y={H - 4} textAnchor="end">
            ONE CLEAN REQUEST
          </text>
        </g>
      </svg>
    </div>
  );
}
