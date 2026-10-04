"use client";

import { m, useReducedMotion } from "framer-motion";
import { Activity, Banknote, Flame, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Usage → revenue → buyback → burn. The last two steps are labelled
 * "Planned" unless the operator has explicitly marked them active — and even
 * then every execution is admin-reviewed and wallet-signed.
 */
export function TokenFlow({ buybackActive }: { buybackActive: boolean }) {
  const reduce = useReducedMotion();
  const nodes = [
    { icon: Activity, title: "Platform usage", body: "Credits spent on chat, image, video and API.", status: { label: "Live", tone: "mint" as const } },
    { icon: Banknote, title: "Revenue", body: "Payments verified on-chain, recorded in the ledger.", status: { label: "Live", tone: "mint" as const } },
    {
      icon: RefreshCcw,
      title: "Token buyback",
      body: "A share of net revenue proposed for market buys on Pump / PumpSwap.",
      status: buybackActive ? { label: "Admin-reviewed", tone: "accent" as const } : { label: "Planned", tone: "amber" as const },
    },
    {
      icon: Flame,
      title: "Burn",
      body: "Bought tokens burned with an SPL burn — supply goes down on-chain.",
      status: buybackActive ? { label: "Admin-reviewed", tone: "accent" as const } : { label: "Planned", tone: "amber" as const },
    },
  ];

  return (
    <div className="relative">
      <ol className="grid gap-3 md:grid-cols-4 md:gap-4">
        {nodes.map((n, i) => (
          <li key={n.title} className="relative flex md:block">
            <div className={cn("card relative z-10 w-full p-5", i >= 2 && !buybackActive && "border-dashed")}>
              <div className="flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-bg">
                  <n.icon size={16} />
                </span>
                <Badge tone={n.status.tone}>{n.status.label}</Badge>
              </div>
              <h3 className="mt-4 text-[15px] font-semibold">
                <span className="mr-1.5 font-mono text-[11px] font-normal text-dim">0{i + 1}</span>
                {n.title}
              </h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{n.body}</p>
            </div>
            {i < nodes.length - 1 ? (
              <div aria-hidden className="absolute top-1/2 -right-4 z-0 hidden h-px w-4 md:block">
                <div className="h-px w-full bg-line" />
                {!reduce ? (
                  <m.span
                    className="absolute -top-[2px] h-[5px] w-[5px] rounded-full bg-ink"
                    animate={{ left: ["-20%", "120%"], opacity: [0, 1, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.5, ease: "easeInOut" }}
                  />
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[12.5px] text-dim">
        {buybackActive
          ? "Each buyback starts as a proposal from the revenue ledger, is reviewed by an admin, and is signed by the treasury wallet. Executions are logged with their transaction signatures."
          : "Proposed token utility. Buyback and burn are not active; when enabled, every step will be a reviewed proposal signed by the treasury wallet — never automatic."}
      </p>
    </div>
  );
}
