import type { SolanaNetwork, TokenLinks } from "@/lib/solana/links";

export type PlanId = "free" | "pro" | "max";
export type PayCurrency = "SOL" | "USDC" | "TOKEN";

export interface PlanConfig {
  id: PlanId;
  name: string;
  priceUsd: number;
  includedCredits: number;
  durationDays: number;
  perks: string[];
}

/** The subset of configuration that is safe to ship to the browser. */
export interface PublicConfig {
  appName: string;
  appUrl: string;
  network: SolanaNetwork;
  /** When set the browser talks to this RPC directly; otherwise it uses the allow-listed /api/solana/rpc proxy. */
  publicRpcUrl: string | null;
  token: {
    mint: string | null;
    symbol: string;
    name: string;
    decimals: number;
    links: TokenLinks | null;
    buybackStatus: "planned" | "active";
  };
  payments: {
    enabled: boolean;
    disabledReason: string | null;
    currencies: Record<PayCurrency, boolean>;
    creditsPerUsd: number;
    tokenBonusBps: number;
    tokenPlanDiscountBps: number;
    packagesUsd: number[];
  };
  plans: PlanConfig[];
  freeDailyMessages: number;
  walletConnectProjectId: string | null;
}
