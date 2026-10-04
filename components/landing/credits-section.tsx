"use client";

import { animate, m, useMotionValue, useTransform } from "framer-motion";
import { ArrowRight, CheckCircle2, PenLine, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useConfig } from "@/components/providers/config-provider";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { creditsForPackage, type PaymentCurrency } from "@/lib/credits/calc";
import { cn } from "@/lib/utils";

function AnimatedNumber({ value }: { value: number }) {
  const mv = useMotionValue(value);
  const rounded = useTransform(mv, (v) => Math.round(v).toLocaleString("en-US"));
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.6, ease: [0.22, 1, 0.36, 1] });
    return c.stop;
  }, [mv, value]);
  return <m.span>{rounded}</m.span>;
}

export function CreditsSection() {
  const cfg = useConfig();
  const packages = cfg.payments.packagesUsd;
  const [usd, setUsd] = useState(packages[1] ?? packages[0] ?? 25);
  const [currency, setCurrency] = useState<PaymentCurrency>("USDC");
  const c = creditsForPackage({ usd, currency, creditsPerUsd: cfg.payments.creditsPerUsd, tokenBonusBps: cfg.payments.tokenBonusBps });
  const bonusPct = cfg.payments.tokenBonusBps / 100;

  const steps = [
    { icon: Sparkles, title: "Choose an amount", body: `Pay in SOL or USDC${cfg.token.mint ? ` or $${cfg.token.symbol}` : ""}. We quote the exact amount.` },
    { icon: PenLine, title: "Approve in your wallet", body: "One transfer to the treasury. Nothing is signed for you." },
    { icon: ShieldCheck, title: "Verified on-chain", body: "Our server checks the transaction itself before any credits are issued." },
  ];

  return (
    <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
      <div className="card relative overflow-hidden p-6 sm:p-8">
        <div aria-hidden className="grid-paper pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <span className="eyebrow">Credit balance preview</span>
            {!cfg.payments.enabled ? <Badge tone="neutral">Opening soon</Badge> : null}
          </div>
          <div className="mt-6 flex items-end gap-3">
            <span className="display text-[64px] sm:text-[84px]">
              <AnimatedNumber value={c.total} />
            </span>
            <span className="mb-3 text-[15px] text-ink-2">credits</span>
          </div>
          <p className={cn("mt-1 h-5 text-[13px] text-mint transition-opacity", c.bonus ? "opacity-100" : "opacity-0")}>
            includes +{c.bonus.toLocaleString("en-US")} bonus for paying with ${cfg.token.symbol}
          </p>

          <div className="mt-8">
            <p className="eyebrow mb-2">Amount</p>
            <div className="grid grid-cols-4 gap-2">
              {packages.map((p) => (
                <button
                  key={p}
                  onClick={() => setUsd(p)}
                  className={cn(
                    "h-11 rounded-xl border text-[15px] font-medium transition-colors",
                    usd === p ? "border-ink bg-ink text-bg" : "border-line bg-surface hover:border-ink/30",
                  )}
                >
                  ${p}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <Segmented
              ariaLabel="Pay with"
              value={currency}
              onChange={setCurrency}
              options={[
                { value: "USDC", label: "USDC" },
                { value: "SOL", label: "SOL" },
                { value: "TOKEN", label: `$${cfg.token.symbol}`, disabled: !cfg.payments.currencies.TOKEN, title: cfg.payments.currencies.TOKEN ? undefined : "Available after the token launches" },
              ]}
            />
            {bonusPct > 0 ? <span className="text-[12.5px] text-dim">+{bonusPct}% credits with ${cfg.token.symbol}</span> : null}
          </div>
          <ButtonLink href={`/app/credits?package=${usd}&currency=${currency}`} size="lg" className="mt-7 w-full">
            Buy {c.total.toLocaleString("en-US")} credits <ArrowRight size={16} />
          </ButtonLink>
          <p className="mt-3 text-center text-[12px] text-dim">1 USD = {cfg.payments.creditsPerUsd} credits · credits don&apos;t expire</p>
        </div>
      </div>

      <div className="flex flex-col justify-center">
        <ol className="relative space-y-8 before:absolute before:top-2 before:bottom-2 before:left-[19px] before:w-px before:bg-line">
          {steps.map((s, i) => (
            <li key={s.title} className="relative grid grid-cols-[40px_1fr] gap-4">
              <span className="relative z-10 grid h-10 w-10 place-items-center rounded-full border border-line bg-surface">
                <s.icon size={16} />
              </span>
              <div>
                <span className="font-mono text-[11px] text-dim">0{i + 1}</span>
                <h3 className="text-[16px] font-semibold">{s.title}</h3>
                <p className="mt-1 text-[14px] text-ink-2">{s.body}</p>
              </div>
            </li>
          ))}
          <li className="relative grid grid-cols-[40px_1fr] gap-4">
            <span className="relative z-10 grid h-10 w-10 place-items-center rounded-full bg-ink text-bg">
              <CheckCircle2 size={16} />
            </span>
            <div className="pt-2.5 text-[14px] text-ink-2">
              Credits land on a pseudonymous account. No email, no name — just a recovery key you keep.
            </div>
          </li>
        </ol>
      </div>
    </div>
  );
}
