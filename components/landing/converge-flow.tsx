"use client";

import { m, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";

const W = 640;
const H = 380;
const CX = 330; // filter aperture
const CY = 190;

// Deterministic "messy" inputs: each starts somewhere on the left and wanders into the aperture.
const INPUTS = Array.from({ length: 11 }, (_, i) => {
  const y0 = 28 + i * 32.4;
  const wob = ((i * 37) % 23) - 11;
  const c1 = { x: 70 + ((i * 53) % 40), y: y0 + wob * 3.2 };
  const c2 = { x: 190 + ((i * 29) % 50), y: CY + (y0 - CY) * 0.35 - wob * 2.4 };
  return { d: `M 0 ${y0} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${CX} ${CY}`, delay: (i * 0.37) % 2.2, dur: 2.6 + ((i * 7) % 5) * 0.25 };
});

const OUTPUT = `M ${CX} ${CY} C ${CX + 90} ${CY}, ${W - 170} ${CY}, ${W - 56} ${CY}`;

const TAGS_IN = [
  { x: 18, y: 64, text: "maya@proton.me" },
  { x: 54, y: 196, text: "Lisbon" },
  { x: 26, y: 318, text: "7xKX…sAsU" },
];
const TAGS_OUT = [
  { x: 420, y: 120, text: "[EMAIL_1]" },
  { x: 452, y: 262, text: "[CITY_1]" },
  { x: 396, y: 300, text: "[WALLET_1]" },
];

/** Many tangled questions converge through one privacy filter and leave as a single calm path. */
export function ConvergeFlow() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduce = useReducedMotion();
  const play = inView && !reduce;

  return (
    <div ref={ref} className="relative -mx-2 w-[calc(100%+16px)] select-none sm:mx-0 sm:w-full" aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible">
        <defs>
          <linearGradient id="cf-fade" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="var(--ink)" stopOpacity="0" />
            <stop offset="0.35" stopColor="var(--ink)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--ink)" stopOpacity="0.55" />
          </linearGradient>
          <radialGradient id="cf-glow">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Inputs: faint tangled strands, drawn in, then flowing toward the filter */}
        {INPUTS.map((p, i) => (
          <g key={i}>
            <m.path
              d={p.d}
              fill="none"
              stroke="url(#cf-fade)"
              strokeWidth="1"
              initial={{ pathLength: reduce ? 1 : 0 }}
              animate={{ pathLength: inView || reduce ? 1 : 0 }}
              transition={{ duration: 1.4, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            />
            {play ? (
              <path
                d={p.d}
                fill="none"
                stroke="var(--ink)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeDasharray="6 420"
                className="animate-[cf-flow_var(--d)_linear_infinite]"
                style={{ ["--d" as string]: `${p.dur}s`, animationDelay: `${p.delay + 1.2}s`, strokeDashoffset: 426 }}
              />
            ) : null}
          </g>
        ))}

        {/* Personal details on the way in */}
        {TAGS_IN.map((t, i) => (
          <m.g key={t.text} initial={{ opacity: 0 }} animate={{ opacity: inView || reduce ? 1 : 0 }} transition={{ delay: 0.6 + i * 0.15, duration: 0.6 }}>
            <rect x={t.x} y={t.y - 15} width={t.text.length * 8.2 + 16} height="24" rx="6" fill="var(--amber-soft)" stroke="var(--amber)" strokeOpacity="0.35" />
            <text x={t.x + 8} y={t.y + 2} fontFamily="var(--font-mono)" fontSize="13" fill="var(--ink-2)">
              {t.text}
            </text>
          </m.g>
        ))}

        {/* The filter aperture */}
        <circle cx={CX} cy={CY} r="70" fill="url(#cf-glow)" />
        {play ? (
          <circle cx={CX} cy={CY} r="20" fill="none" stroke="var(--accent)" strokeWidth="1" className="origin-center animate-[cf-pulse_2.4s_ease-out_infinite]" style={{ transformOrigin: `${CX}px ${CY}px` }} />
        ) : null}
        <rect x={CX - 9} y={CY - 46} width="18" height="92" rx="9" fill="var(--surface)" stroke="var(--line)" />
        {[-28, -14, 0, 14, 28].map((dy, i) => (
          <rect key={dy} x={CX - 4.5} y={CY + dy - 2} width="9" height="4" rx="2" fill="var(--accent)" opacity={0.25 + (i % 2) * 0.35} />
        ))}

        {/* Output: one calm line */}
        <m.path
          d={OUTPUT}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: reduce ? 1 : 0 }}
          animate={{ pathLength: inView || reduce ? 1 : 0 }}
          transition={{ duration: 1.1, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
        {play ? (
          <path
            d={OUTPUT}
            fill="none"
            stroke="var(--surface)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray="3 18"
            className="animate-[cf-out_1.2s_linear_infinite]"
          />
        ) : null}

        {/* Placeholders on the way out */}
        {TAGS_OUT.map((t, i) => (
          <m.g key={t.text} initial={{ opacity: 0, y: 6 }} animate={{ opacity: inView || reduce ? 1 : 0, y: 0 }} transition={{ delay: 1.6 + i * 0.15, duration: 0.6 }}>
            <rect x={t.x} y={t.y - 15} width={t.text.length * 8.2 + 16} height="24" rx="6" fill="var(--accent-soft)" stroke="var(--accent-line)" />
            <text x={t.x + 8} y={t.y + 2} fontFamily="var(--font-mono)" fontSize="13" fill="var(--accent-ink)">
              {t.text}
            </text>
          </m.g>
        ))}

        {/* Destination */}
        <m.g initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: inView || reduce ? 1 : 0, scale: 1 }} transition={{ delay: 1.9, duration: 0.5 }} style={{ transformOrigin: `${W - 40}px ${CY}px` }}>
          <circle cx={W - 40} cy={CY} r="16" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.5" />
          <circle cx={W - 40} cy={CY} r="5" fill="var(--accent)" />
        </m.g>

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
