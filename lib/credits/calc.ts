/**
 * Pure credit arithmetic shared by the server (authoritative) and the UI
 * (previews). All configuration is passed in; nothing is hard-coded here.
 */

const BPS = 10_000;

export function usdToCredits(usd: number, creditsPerUsd: number): number {
  if (!Number.isFinite(usd) || usd < 0) throw new Error("usd must be a non-negative number");
  // Round to cents first to avoid float drift (e.g. 0.1 + 0.2).
  const cents = Math.round(usd * 100);
  return Math.floor((cents * creditsPerUsd) / 100);
}

/** Extra credits for paying with the project token, e.g. 1000 bps = +10%. */
export function applyTokenBonus(credits: number, bonusBps: number): number {
  if (bonusBps < 0 || bonusBps > BPS) throw new Error("bonusBps out of range");
  return Math.floor((credits * (BPS + bonusBps)) / BPS);
}

/** TOKEN = transfer the project token to the treasury; BURN = burn the project token. */
export type PaymentCurrency = "SOL" | "USDC" | "TOKEN" | "BURN";

export interface PackageCreditsInput {
  usd: number;
  currency: PaymentCurrency;
  creditsPerUsd: number;
  tokenBonusBps: number;
}

export function creditsForPackage({ usd, currency, creditsPerUsd, tokenBonusBps }: PackageCreditsInput) {
  const base = usdToCredits(usd, creditsPerUsd);
  const total = currency === "TOKEN" ? applyTokenBonus(base, tokenBonusBps) : base;
  return { base, bonus: total - base, total };
}

/** Plan price in USD after the project-token discount (if paying with the token). */
export function planPriceUsd(priceUsd: number, currency: PaymentCurrency, tokenDiscountBps: number, burnDiscountBps = 0): number {
  if (tokenDiscountBps < 0 || tokenDiscountBps > BPS) throw new Error("tokenDiscountBps out of range");
  if (currency === "BURN") return burnPriceUsd(priceUsd, burnDiscountBps);
  const cents = Math.round(priceUsd * 100);
  const discounted = currency === "TOKEN" ? Math.ceil((cents * (BPS - tokenDiscountBps)) / BPS) : cents;
  return discounted / 100;
}

/** USD value of tokens to burn for something listed at `priceUsd` (e.g. 2000 bps = 20% cheaper than USDC). */
export function burnPriceUsd(priceUsd: number, burnDiscountBps: number): number {
  if (burnDiscountBps < 0 || burnDiscountBps >= BPS) throw new Error("burnDiscountBps out of range");
  const cents = Math.round(priceUsd * 100);
  return Math.ceil((cents * (BPS - burnDiscountBps)) / BPS) / 100;
}

/** USD amount actually charged for a credit package in a given currency. */
export function packageChargeUsd(usd: number, currency: PaymentCurrency, burnDiscountBps: number): number {
  return currency === "BURN" ? burnPriceUsd(usd, burnDiscountBps) : usd;
}

export interface UsageCostInput {
  inputTokens: number;
  outputTokens: number;
  /** Provider list price, USD per 1M tokens. */
  inputPerMTokUsd: number;
  outputPerMTokUsd: number;
  markupBps: number;
  creditsPerUsd: number;
}

/** Provider cost in USD for a request (no markup). */
export function providerCostUsd({ inputTokens, outputTokens, inputPerMTokUsd, outputPerMTokUsd }: UsageCostInput): number {
  return (inputTokens * inputPerMTokUsd + outputTokens * outputPerMTokUsd) / 1_000_000;
}

/** Credits charged for a request: provider cost + markup, rounded up, minimum 1. */
export function usageCostCredits(input: UsageCostInput): number {
  const cost = providerCostUsd(input) * (1 + input.markupBps / BPS);
  // Work in micro-credits to keep rounding stable.
  const micro = Math.ceil(cost * input.creditsPerUsd * 1_000_000 - 1e-6);
  return Math.max(1, Math.ceil(micro / 1_000_000));
}

/** Credits for fixed-price media (per image / per video second), rounded up, minimum 1. */
export function fixedCostCredits(unitUsd: number, units: number, markupBps: number, creditsPerUsd: number): number {
  const usd = unitUsd * units * (1 + markupBps / BPS);
  return Math.max(1, Math.ceil(usd * creditsPerUsd - 1e-9));
}

/**
 * Convert a USD amount into base units of an asset priced in USD, rounding up
 * so the treasury never receives less than the quoted value.
 */
export function usdToBaseUnits(usd: number, unitPriceUsd: number, decimals: number): bigint {
  if (!(unitPriceUsd > 0)) throw new Error("unit price must be positive");
  const units = (usd / unitPriceUsd) * 10 ** decimals;
  if (!Number.isFinite(units) || units > Number.MAX_SAFE_INTEGER) throw new Error("amount out of range");
  return BigInt(Math.ceil(units - 1e-9));
}

export function formatBaseUnits(amount: bigint, decimals: number, maxFraction = 6): string {
  const neg = amount < 0n;
  const abs = neg ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  let frac = (abs % base).toString().padStart(decimals, "0").slice(0, maxFraction).replace(/0+$/, "");
  if (decimals === 0) frac = "";
  return `${neg ? "-" : ""}${whole.toLocaleString("en-US")}${frac ? "." + frac : ""}`;
}
