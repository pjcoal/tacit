"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { useConfig } from "@/components/providers/config-provider";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { currencyOptions } from "@/components/credits/currency-options";
import { planPriceUsd, type PaymentCurrency } from "@/lib/credits/calc";
import { cn, formatUsd } from "@/lib/utils";

export function Pricing() {
  const cfg = useConfig();
  const [currency, setCurrency] = useState<PaymentCurrency>("USDC");

  return (
    <div>
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <Segmented
          ariaLabel="Pay with"
          value={currency}
          onChange={setCurrency}
          options={currencyOptions(cfg)}
        />
        <p className="text-[13px] text-ink-2">
          {cfg.payments.burnDiscountBps > 0 ? `${cfg.payments.burnDiscountBps / 100}% off with $${cfg.token.symbol}, paid by burning it. ` : ""}Fixed-duration access — nothing renews or charges automatically.
        </p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {cfg.plans.map((p) => {
          const price = planPriceUsd(p.priceUsd, currency, cfg.payments.tokenPlanDiscountBps, cfg.payments.burnDiscountBps);
          const featured = p.id === "pro";
          return (
            <div key={p.id} className={cn("card relative flex flex-col p-6 sm:p-7", featured && "border-ink/40 shadow-[var(--shadow-pop)]")}>
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-semibold">{p.name}</h3>
                {featured ? <Badge tone="accent">Recommended</Badge> : null}
              </div>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="display text-[56px]">{p.priceUsd === 0 ? "$0" : formatUsd(price)}</span>
                {p.priceUsd > 0 ? <span className="text-[14px] text-dim">/ {p.durationDays} days</span> : null}
              </div>
              {p.priceUsd > 0 && (currency === "TOKEN" || currency === "BURN") && price < p.priceUsd ? (
                <p className="mt-1 text-[12.5px] text-mint">
                  <span className="text-dim line-through">{formatUsd(p.priceUsd)}</span> {currency === "BURN" ? "burned" : "paid"} in ${cfg.token.symbol}
                </p>
              ) : (
                <p className="mt-1 h-[18px] text-[12.5px] text-dim">{p.priceUsd > 0 ? `Paid once in ${currency === "TOKEN" ? "$" + cfg.token.symbol : currency}` : "No wallet needed"}</p>
              )}
              <ul className="mt-7 flex-1 space-y-3">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex gap-2.5 text-[14px] text-ink-2">
                    <Check size={15} className="mt-0.5 shrink-0 text-ink" /> {perk}
                  </li>
                ))}
              </ul>
              <ButtonLink
                href={p.id === "free" ? "/app" : `/app/credits?plan=${p.id}&currency=${currency}`}
                variant={featured ? "primary" : "secondary"}
                className="mt-8 w-full"
              >
                {p.id === "free" ? "Start free" : `Get ${p.name}`}
              </ButtonLink>
            </div>
          );
        })}
      </div>
    </div>
  );
}
