"use client";

import { m } from "framer-motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import type { ReactNode } from "react";

/** Fade-and-rise on first scroll into view. Respects reduced motion. */
export function Reveal({ children, className, delay = 0, y = 14 }: { children: ReactNode; className?: string; delay?: number; y?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  );
}
