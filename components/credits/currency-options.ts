import type { SegmentOption } from "@/components/ui/segmented";
import type { PaymentCurrency } from "@/lib/credits/calc";
import type { PublicConfig } from "@/types/config";

/** Payment currency choices shared by the landing page, pricing and credits page. */
export function currencyOptions(cfg: PublicConfig): SegmentOption<PaymentCurrency>[] {
  const later = "Available after the token launches";
  return [
    { value: "USDC", label: "USDC" },
    { value: "SOL", label: "SOL" },
    { value: "TOKEN", label: `$${cfg.token.symbol}`, disabled: !cfg.payments.currencies.TOKEN, title: cfg.payments.currencies.TOKEN ? undefined : later },
    {
      value: "BURN",
      label: `Burn $${cfg.token.symbol}`,
      disabled: !cfg.payments.currencies.BURN,
      title: cfg.payments.currencies.BURN ? `Burn $${cfg.token.symbol} for credits at ${cfg.payments.burnDiscountBps / 100}% off` : later,
    },
  ];
}

/** Fall back to USDC if the chosen currency isn't enabled on this deployment. */
export function effectiveCurrency(cfg: PublicConfig, c: PaymentCurrency): PaymentCurrency {
  return cfg.payments.currencies[c] ? c : "USDC";
}

export function currencyLabel(cfg: PublicConfig, c: PaymentCurrency): string {
  return c === "TOKEN" || c === "BURN" ? `$${cfg.token.symbol}` : c;
}
