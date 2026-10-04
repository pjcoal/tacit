import "server-only";
import { env } from "@/server/env";
import { tokenLinks } from "@/lib/solana/links";
import type { PlanConfig, PublicConfig } from "@/types/config";
import { isDatabaseConfigured } from "@/server/db/client";

export function getPlans(): PlanConfig[] {
  const e = env();
  return [
    {
      id: "free",
      name: "Free",
      priceUsd: 0,
      includedCredits: 0,
      durationDays: 0,
      perks: [
        `${e.FREE_DAILY_MESSAGES} chat messages per day on free-tier models`,
        "Smart, Strict and Off privacy modes",
        "Browser-local history",
        "No account or wallet required",
      ],
    },
    {
      id: "pro",
      name: "Pro",
      priceUsd: e.PLAN_PRO_USD,
      includedCredits: e.PLAN_PRO_CREDITS,
      durationDays: e.PLAN_DURATION_DAYS,
      perks: [
        `${e.PLAN_PRO_CREDITS.toLocaleString("en-US")} credits included`,
        "No daily message cap while you have credits",
        "Chat and the coding agent",
        "API access using the same credits",
        "Higher rate limits than the free tier",
      ],
    },
    {
      id: "max",
      name: "Max",
      priceUsd: e.PLAN_MAX_USD,
      includedCredits: e.PLAN_MAX_CREDITS,
      durationDays: e.PLAN_DURATION_DAYS,
      perks: [
        `${e.PLAN_MAX_CREDITS.toLocaleString("en-US")} credits included`,
        "Everything in Pro",
        "More credits per dollar than Pro",
      ],
    },
  ];
}

export function getPublicConfig(): PublicConfig {
  const e = env();
  const mint = e.PROJECT_TOKEN_MINT ?? null;

  let disabledReason: string | null = null;
  if (!e.TREASURY_WALLET) disabledReason = "Treasury wallet not configured";
  else if (!isDatabaseConfigured()) disabledReason = "Database not configured";

  return {
    appName: e.NEXT_PUBLIC_APP_NAME,
    appUrl: e.NEXT_PUBLIC_APP_URL,
    network: e.SOLANA_NETWORK,
    publicRpcUrl: e.NEXT_PUBLIC_SOLANA_RPC_URL ?? null,
    token: {
      mint,
      symbol: e.PROJECT_TOKEN_SYMBOL,
      name: e.PROJECT_TOKEN_NAME,
      decimals: e.PROJECT_TOKEN_DECIMALS,
      links: mint ? tokenLinks(mint, e.SOLANA_NETWORK, e.PUMP_URL) : null,
      buybackStatus: e.TOKEN_BUYBACK_STATUS,
    },
    payments: {
      enabled: disabledReason === null,
      disabledReason,
      currencies: { SOL: true, USDC: true, TOKEN: Boolean(mint) },
      creditsPerUsd: e.CREDITS_PER_USD,
      tokenBonusBps: e.TOKEN_CREDIT_BONUS_BPS,
      tokenPlanDiscountBps: e.TOKEN_PLAN_DISCOUNT_BPS,
      packagesUsd: e.CREDIT_PACKAGES_USD,
    },
    plans: getPlans(),
    freeDailyMessages: e.FREE_DAILY_MESSAGES,
    walletConnectProjectId: e.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? null,
  };
}
