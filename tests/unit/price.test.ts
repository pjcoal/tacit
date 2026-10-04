import { describe, expect, it } from "vitest";
import { decodePriceUpdateV2, validateSolUsd } from "@/lib/solana/price";

const FEED = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

function account(o: { feed?: string; full?: boolean; price?: bigint; conf?: bigint; expo?: number; time: number }) {
  const b = Buffer.alloc(134);
  let i = 8 + 32;
  if (o.full ?? true) b[i++] = 1;
  else {
    b[i++] = 0;
    b[i++] = 3;
  }
  Buffer.from(o.feed ?? FEED, "hex").copy(b, i);
  i += 32;
  b.writeBigInt64LE(o.price ?? 12_000_000_000n, i);
  i += 8;
  b.writeBigUInt64LE(o.conf ?? 1_600_000n, i);
  i += 8;
  b.writeInt32LE(o.expo ?? -8, i);
  i += 4;
  b.writeBigInt64LE(BigInt(o.time), i);
  return b;
}

describe("Pyth on-chain SOL/USD", () => {
  const now = 1_800_000_000;
  it("decodes and accepts a fresh, verified, tight price", () => {
    const p = decodePriceUpdateV2(account({ time: now - 20 }));
    expect(p.price).toBeCloseTo(120);
    expect(validateSolUsd(p, now)).toBeCloseTo(120);
  });
  it("rejects stale, unverified, wrong-feed and wide prices", () => {
    expect(() => validateSolUsd(decodePriceUpdateV2(account({ time: now - 500 })), now)).toThrow(/stale/);
    expect(() => validateSolUsd(decodePriceUpdateV2(account({ time: now, full: false })), now)).toThrow(/verified/);
    expect(() => validateSolUsd(decodePriceUpdateV2(account({ time: now, feed: "00".repeat(32) })), now)).toThrow(/feed/);
    expect(() => validateSolUsd(decodePriceUpdateV2(account({ time: now, conf: 600_000_000n })), now)).toThrow(/uncertain/);
  });
});
