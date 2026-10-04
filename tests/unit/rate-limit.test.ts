import { describe, expect, it } from "vitest";
import { MemoryRateLimiter } from "@/lib/security/rate-limit";

describe("MemoryRateLimiter", () => {
  it("allows up to the limit, then blocks until the window resets", async () => {
    let now = 1_000_000;
    const rl = new MemoryRateLimiter(() => now);
    for (let i = 0; i < 3; i++) expect((await rl.limit("k", 3, 1000)).success).toBe(true);
    const blocked = await rl.limit("k", 3, 1000);
    expect(blocked).toMatchObject({ success: false, remaining: 0 });
    now += 1001;
    expect((await rl.limit("k", 3, 1000)).success).toBe(true);
  });

  it("keeps keys independent", async () => {
    const rl = new MemoryRateLimiter();
    expect((await rl.limit("a", 1, 1000)).success).toBe(true);
    expect((await rl.limit("a", 1, 1000)).success).toBe(false);
    expect((await rl.limit("b", 1, 1000)).success).toBe(true);
  });

  it("reports remaining and reset time", async () => {
    const rl = new MemoryRateLimiter(() => 5000);
    const r = await rl.limit("x", 10, 60_000);
    expect(r).toMatchObject({ remaining: 9, limit: 10, resetAt: 65_000 });
  });
});
