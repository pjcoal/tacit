import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { isBase58PublicKey } from "@/lib/solana/address";

/**
 * Strict, server-only environment validation. Anything secret lives here and
 * is never imported by client components ("server-only" makes that a build error).
 */

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const optionalUrl = optionalString.refine(
  (v) => v === undefined || /^https?:\/\/[^\s]+$/i.test(v),
  "must be an http(s) URL",
);

const optionalPubkey = optionalString.refine(
  (v) => v === undefined || isBase58PublicKey(v),
  "must be a base58 Solana public key",
);

const intFromEnv = (def: number, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v.trim() === "" ? def : Number(v)))
    .pipe(z.number().int().min(min).max(max));

const numFromEnv = (def: number, min = 0) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v.trim() === "" ? def : Number(v)))
    .pipe(z.number().finite().min(min));

const boolFromEnv = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v.trim() === "" ? def : v.trim().toLowerCase() === "true"));

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  NEXT_PUBLIC_APP_NAME: optionalString.transform((v) => v ?? "Veil"),
  NEXT_PUBLIC_APP_URL: optionalUrl.transform((v) => (v ?? "http://localhost:3000").replace(/\/$/, "")),

  SOLANA_NETWORK: z.enum(["devnet", "testnet", "mainnet-beta"]).default("devnet"),
  SOLANA_RPC_URL: optionalUrl,
  NEXT_PUBLIC_SOLANA_RPC_URL: optionalUrl,

  PROJECT_TOKEN_MINT: optionalPubkey,
  PROJECT_TOKEN_SYMBOL: optionalString.transform((v) => v ?? "VEIL"),
  PROJECT_TOKEN_NAME: optionalString.transform((v) => v ?? "Veil"),
  PROJECT_TOKEN_DECIMALS: intFromEnv(6, 0, 12),
  PUMP_URL: optionalUrl,

  TREASURY_WALLET: optionalPubkey,
  USDC_MINT: optionalPubkey,

  TOKEN_CREDIT_BONUS_BPS: intFromEnv(1000, 0, 10_000),
  TOKEN_PLAN_DISCOUNT_BPS: intFromEnv(1000, 0, 5_000),
  /** Burning the project token for credits costs this much less than USDC (2000 = 20% cheaper). */
  TOKEN_BURN_DISCOUNT_BPS: intFromEnv(2000, 0, 9_000),
  CREDITS_PER_USD: intFromEnv(100, 1, 1_000_000),
  CREDIT_PACKAGES_USD: optionalString.transform((v) =>
    (v ?? "10,25,50,100")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0 && n <= 10_000),
  ),
  PRICE_MARKUP_BPS: intFromEnv(2000, 0, 50_000),
  FREE_DAILY_MESSAGES: intFromEnv(20, 0, 10_000),

  PLAN_PRO_USD: numFromEnv(12, 0),
  PLAN_PRO_CREDITS: intFromEnv(1500, 0),
  PLAN_MAX_USD: numFromEnv(60, 0),
  PLAN_MAX_CREDITS: intFromEnv(8500, 0),
  PLAN_DURATION_DAYS: intFromEnv(30, 1, 366),

  TOKEN_GATE_HOLDER_MIN: numFromEnv(0, 0),

  ANTHROPIC_API_KEY: optionalString,
  /** Required for keys that aren't scoped to a single workspace. */
  ANTHROPIC_WORKSPACE_ID: optionalString,
  OPENAI_API_KEY: optionalString,
  OPENROUTER_API_KEY: optionalString,
  GOOGLE_API_KEY: optionalString,
  TOGETHER_API_KEY: optionalString,
  FIREWORKS_API_KEY: optionalString,
  REPLICATE_API_TOKEN: optionalString,
  OPENAI_COMPATIBLE_BASE_URL: optionalUrl,
  OPENAI_COMPATIBLE_API_KEY: optionalString,
  CUSTOM_MODELS: optionalString,
  DISABLED_MODELS: optionalString.transform((v) =>
    (v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ),

  DATABASE_URL: optionalString,
  PGLITE_DIR: optionalString,

  SERVER_SECRET: optionalString,
  ADMIN_WALLETS: optionalString.transform((v) =>
    (v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && isBase58PublicKey(s)),
  ),
  ALLOW_MAINNET_TOKEN_CREATION: boolFromEnv(false),
  TOKEN_BUYBACK_STATUS: z.enum(["planned", "active"]).default("planned"),
  BUYBACK_ALLOCATION_BPS: intFromEnv(2000, 0, 10_000),
  PAYMENT_COMMITMENT: z.enum(["confirmed", "finalized"]).optional(),
  PAYMENT_INTENT_TTL_SECONDS: intFromEnv(180, 30, 3600),

  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalString,
  PINATA_JWT: optionalString,
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: optionalString,
});

export type ServerEnv = z.infer<typeof schema> & {
  serverSecret: string;
  rpcUrl: string;
  usdcMint: string;
  paymentCommitment: "confirmed" | "finalized";
};

const DEFAULT_RPC: Record<ServerEnv["SOLANA_NETWORK"], string> = {
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
};

// Circle's official USDC mints.
const DEFAULT_USDC: Record<ServerEnv["SOLANA_NETWORK"], string> = {
  devnet: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  testnet: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  "mainnet-beta": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
};

let cached: ServerEnv | null = null;
let devSecret: string | null = null;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const e = parsed.data;

  let serverSecret = e.SERVER_SECRET;
  if (!serverSecret || serverSecret.length < 32) {
    if (e.NODE_ENV === "production") {
      throw new Error("SERVER_SECRET must be set to at least 32 characters in production.");
    }
    // Development only: an ephemeral secret. Sessions and API keys reset on restart.
    devSecret ??= randomBytes(32).toString("hex");
    serverSecret = devSecret;
  }

  if (e.NODE_ENV === "production" && e.SOLANA_RPC_URL && !e.SOLANA_RPC_URL.startsWith("https://")) {
    throw new Error("SOLANA_RPC_URL must use https in production.");
  }

  cached = {
    ...e,
    serverSecret,
    rpcUrl: e.SOLANA_RPC_URL ?? DEFAULT_RPC[e.SOLANA_NETWORK],
    usdcMint: e.USDC_MINT ?? DEFAULT_USDC[e.SOLANA_NETWORK],
    paymentCommitment: e.PAYMENT_COMMITMENT ?? (e.SOLANA_NETWORK === "mainnet-beta" ? "finalized" : "confirmed"),
  };
  return cached;
}

/** For tests: drop the memoized env so a changed process.env is re-read. */
export function resetEnvCache() {
  cached = null;
}
