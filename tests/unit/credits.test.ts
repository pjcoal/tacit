import { describe, expect, it } from "vitest";
import {
  applyTokenBonus,
  burnPriceUsd,
  packageChargeUsd,
  creditsForPackage,
  fixedCostCredits,
  formatBaseUnits,
  planPriceUsd,
  providerCostUsd,
  usageCostCredits,
  usdToBaseUnits,
  usdToCredits,
} from "@/lib/credits/calc";

describe("credit calculations", () => {
  it("converts USD to credits without float drift", () => {
    expect(usdToCredits(10, 100)).toBe(1000);
    expect(usdToCredits(0.1 + 0.2, 100)).toBe(30);
    expect(usdToCredits(25, 100)).toBe(2500);
    expect(() => usdToCredits(-1, 100)).toThrow();
  });

  it("charges at least one credit and rounds up", () => {
    const base = { inputPerMTokUsd: 1, outputPerMTokUsd: 5, markupBps: 2000, creditsPerUsd: 100 };
    expect(usageCostCredits({ ...base, inputTokens: 10, outputTokens: 10 })).toBe(1);
    // 100k in * $1/M + 20k out * $5/M = $0.20 → +20% = $0.24 → 24 credits
    expect(usageCostCredits({ ...base, inputTokens: 100_000, outputTokens: 20_000 })).toBe(24);
    expect(providerCostUsd({ ...base, inputTokens: 1_000_000, outputTokens: 0 })).toBeCloseTo(1);
  });

  it("prices fixed-cost media", () => {
    expect(fixedCostCredits(0.04, 1, 2000, 100)).toBe(5); // $0.048 → 4.8 → 5
    expect(fixedCostCredits(0.045, 6, 0, 100)).toBe(27);
  });
});

describe("token payment discount / bonus", () => {
  it("applies the configured bonus to token payments only", () => {
    expect(creditsForPackage({ usd: 10, currency: "USDC", creditsPerUsd: 100, tokenBonusBps: 1000 })).toEqual({ base: 1000, bonus: 0, total: 1000 });
    expect(creditsForPackage({ usd: 10, currency: "SOL", creditsPerUsd: 100, tokenBonusBps: 1000 }).total).toBe(1000);
    expect(creditsForPackage({ usd: 10, currency: "TOKEN", creditsPerUsd: 100, tokenBonusBps: 1000 })).toEqual({ base: 1000, bonus: 100, total: 1100 });
  });

  it("respects zero and bounds", () => {
    expect(applyTokenBonus(1000, 0)).toBe(1000);
    expect(applyTokenBonus(1000, 2500)).toBe(1250);
    expect(() => applyTokenBonus(1000, 10_001)).toThrow();
  });

  it("discounts plan prices for token payments", () => {
    expect(planPriceUsd(12, "USDC", 1000)).toBe(12);
    expect(planPriceUsd(12, "TOKEN", 1000)).toBe(10.8);
    expect(planPriceUsd(60, "TOKEN", 2500)).toBe(45);
  });
});

describe("quote conversion", () => {
  it("rounds base units up so the treasury is never short", () => {
    expect(usdToBaseUnits(25, 1, 6)).toBe(25_000_000n);
    expect(usdToBaseUnits(10, 150, 9)).toBe(66_666_667n); // 0.0666… SOL
    expect(usdToBaseUnits(10, 0.00002, 6)).toBe(500_000_000_000n);
    expect(() => usdToBaseUnits(10, 0, 6)).toThrow();
  });

  it("formats base units", () => {
    expect(formatBaseUnits(66_666_667n, 9, 6)).toBe("0.066666");
    expect(formatBaseUnits(1_500_000_000n, 6, 2)).toBe("1,500");
  });
});

describe("burn for credits", () => {
  it("is cheaper than USDC by the configured discount, with the same credits", () => {
    expect(burnPriceUsd(10, 2000)).toBe(8);
    expect(packageChargeUsd(25, "BURN", 2000)).toBe(20);
    expect(packageChargeUsd(25, "USDC", 2000)).toBe(25);
    expect(creditsForPackage({ usd: 10, currency: "BURN", creditsPerUsd: 100, tokenBonusBps: 1000 })).toEqual({ base: 1000, bonus: 0, total: 1000 });
    expect(planPriceUsd(12, "BURN", 1000, 2000)).toBe(9.6);
    expect(() => burnPriceUsd(10, 10_000)).toThrow();
  });
});
