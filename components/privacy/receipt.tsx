"use client";

import { AnimatePresence, m } from "framer-motion";
import { AlertTriangle, ChevronDown, ShieldCheck, ShieldOff } from "lucide-react";
import { useState } from "react";
import type { Receipt } from "@/lib/storage/db";
import { cn } from "@/lib/utils";
import { WithOriginals, WithPlaceholders } from "./highlight";

/** Per-message "what left this device" disclosure. */
export function PrivacyReceipt({ receipt, align = "right" }: { receipt: Receipt; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const n = receipt.replacements.length;
  const off = receipt.mode === "off";
  const Icon = off ? ShieldOff : ShieldCheck;
  return (
    <div className={cn("mt-1.5", align === "right" && "flex flex-col items-end")}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn("inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[11px] transition-colors hover:bg-ink/5", off ? "text-amber" : n ? "text-mint" : "text-dim")}
        data-testid="privacy-receipt-toggle"
      >
        <Icon size={12} />
        {off ? "Sent unfiltered" : n ? `${n} replaced before sending` : "Nothing to replace"}
        <ChevronDown size={12} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="w-full max-w-[640px] overflow-hidden"
          >
            <div className="mt-2 rounded-xl border border-line bg-surface p-4 text-left text-[13px]" data-testid="privacy-receipt">
              <div className="flex items-center justify-between">
                <span className="eyebrow !text-ink">Privacy receipt</span>
                <span className="font-mono text-[10.5px] uppercase text-dim">mode · {receipt.mode}</span>
              </div>
              <div className="mt-3 grid gap-3">
                <div>
                  <div className="eyebrow mb-1">You sent</div>
                  <div className="leading-relaxed whitespace-pre-wrap">
                    <WithOriginals text={receipt.original} values={receipt.replacements.map((r) => r.value)} />
                  </div>
                </div>
                <div>
                  <div className="eyebrow mb-1">Model received</div>
                  <div className="rounded-lg bg-sunken p-2.5 leading-relaxed whitespace-pre-wrap">
                    <WithPlaceholders text={receipt.sanitized} />
                  </div>
                </div>
              </div>
              {n ? (
                <ul className="mt-3 grid gap-1 border-t border-line-2 pt-3 font-mono text-[11.5px]">
                  {receipt.replacements.map((r) => (
                    <li key={r.placeholder} className="flex items-center gap-2">
                      <span className="chip-ph">{r.placeholder}</span>
                      <span className="text-dim">←</span>
                      <span className="truncate">{r.type === "SECRET" ? "•••••• (removed)" : r.value}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {receipt.warnings.map((w) => (
                <p key={w} className="mt-3 flex items-start gap-1.5 text-[12px] text-amber">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {w}
                </p>
              ))}
              <p className="mt-3 text-[11.5px] text-dim">The mapping stays in this browser. Images, if attached, are sent unmodified.</p>
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
