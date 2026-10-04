"use client";

import { useReducedMotion } from "@/lib/use-reduced-motion";

// Deterministic particles shed from the lower half of the mark.
const PARTICLES = Array.from({ length: 22 }, (_, i) => {
  const angle = 200 + ((i * 47) % 140); // mostly downward-left to downward-right
  const dist = 70 + ((i * 29) % 60);
  const rad = (angle * Math.PI) / 180;
  return {
    x: Math.cos(rad) * dist,
    y: Math.abs(Math.sin(rad)) * dist * 0.9 + 10,
    size: 1.6 + ((i * 13) % 5) * 0.5,
    delay: (i * 0.41) % 4.5,
    dur: 3.6 + ((i * 7) % 6) * 0.35,
    sx: -26 + ((i * 17) % 52),
  };
});

/**
 * The Veil mark slowly shedding particles — every $VEIL spent leaves supply —
 * inside two quiet orbits. Purely decorative.
 */
export function BurnVisual({ symbol, standard, discountPct }: { symbol: string; standard: string; discountPct: number }) {
  const reduce = useReducedMotion();
  const R = 160;
  const orbitLabels = [
    { angle: -128, text: discountPct > 0 ? `${discountPct}% OFF · BURNED` : "BURNED ON SPEND" },
    { angle: 32, text: "SOLANA" },
  ];
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[420px] select-none" aria-hidden>
      <svg viewBox="-210 -210 420 420" className="h-full w-full overflow-visible">
        <defs>
          <radialGradient id="bv-glow">
            <stop offset="0" stopColor="#8d82ff" stopOpacity="0.32" />
            <stop offset="0.6" stopColor="#8d82ff" stopOpacity="0.06" />
            <stop offset="1" stopColor="#8d82ff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle r="150" fill="url(#bv-glow)" />
        <circle r={R} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
        <g className={reduce ? undefined : "animate-[orbit_90s_linear_infinite]"}>
          <circle r="104" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="1" strokeDasharray="3 5" />
          <circle cx="104" cy="0" r="3.5" fill="#c9c3ff" />
          <circle cx="-104" cy="0" r="3.5" fill="#c9c3ff" />
        </g>
        <g className={reduce ? undefined : "animate-[orbit_140s_linear_infinite_reverse]"}>
          {[-128, 32, 140].map((a) => {
            const r = (a * Math.PI) / 180;
            return <circle key={a} cx={Math.cos(r) * R} cy={Math.sin(r) * R} r="3.5" fill="#c9c3ff" />;
          })}
        </g>

        {/* Particles leaving supply */}
        {!reduce
          ? PARTICLES.map((p, i) => (
              <circle
                key={i}
                r={p.size}
                fill={i % 3 === 0 ? "#8d82ff" : "#e8eae8"}
                className="animate-[bv-shed_var(--d)_ease-out_infinite]"
                style={{
                  ["--d" as string]: `${p.dur}s`,
                  ["--sx" as string]: `${p.sx}px`,
                  ["--tx" as string]: `${p.x}px`,
                  ["--ty" as string]: `${p.y}px`,
                  animationDelay: `${p.delay}s`,
                  opacity: 0,
                }}
              />
            ))
          : null}

        {/* The mark */}
        <g transform="scale(5.2) translate(-12 -12)">
          <path d="M12 2a10 10 0 0 1 10 10.0H2A10 10 0 0 1 12 2Z" transform="translate(0 -1.6)" fill="#ecedeb" />
          <path d="M2 12h20a10 10 0 0 1-20 0Z" transform="translate(0 1.6)" fill="#ecedeb" opacity="0.92" />
          <rect x="15.5" y="11.1" width="6.5" height="1.8" rx="0.9" fill="#8d82ff" />
        </g>
      </svg>

      {orbitLabels.map((l) => {
        const r = (l.angle * Math.PI) / 180;
        const x = 50 + (Math.cos(r) * R * 100) / 420;
        const y = 50 + (Math.sin(r) * R * 100) / 420;
        return (
          <span
            key={l.text}
            className="absolute -translate-x-1/2 -translate-y-[160%] rounded-md bg-panel/80 px-2 py-0.5 font-mono text-[10.5px] tracking-[0.12em] whitespace-nowrap text-panel-dim backdrop-blur-sm"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {l.text}
          </span>
        );
      })}
      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 font-mono text-[11px] tracking-[0.14em] whitespace-nowrap text-[#b5aaff]">
        {symbol} · {standard}
      </span>
    </div>
  );
}
