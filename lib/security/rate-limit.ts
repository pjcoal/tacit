export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** epoch ms when the current window resets */
  resetAt: number;
}

export interface RateLimiter {
  limit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

/**
 * Fixed-window counter held in process memory. Correct for a single instance;
 * for multiple instances configure Upstash (UPSTASH_REDIS_REST_URL/TOKEN).
 */
export class MemoryRateLimiter implements RateLimiter {
  private windows = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = 0;

  constructor(private now: () => number = Date.now) {}

  async limit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = this.now();
    this.sweep(now);
    let w = this.windows.get(key);
    if (!w || w.resetAt <= now) {
      w = { count: 0, resetAt: now + windowMs };
      this.windows.set(key, w);
    }
    w.count++;
    return { success: w.count <= limit, limit, remaining: Math.max(0, limit - w.count), resetAt: w.resetAt };
  }

  private sweep(now: number) {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [k, w] of this.windows) if (w.resetAt <= now) this.windows.delete(k);
  }
}

/** Upstash Redis over its REST API (no SDK dependency). */
export class UpstashRateLimiter implements RateLimiter {
  constructor(
    private url: string,
    private token: string,
  ) {}

  async limit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const windowId = Math.floor(Date.now() / windowMs);
    const redisKey = `rl:${key}:${windowId}`;
    const res = await fetch(`${this.url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["PEXPIRE", redisKey, String(windowMs), "NX"],
      ]),
    });
    if (!res.ok) throw new Error(`Rate limiter unavailable (${res.status})`);
    const [incr] = (await res.json()) as Array<{ result: number }>;
    const count = Number(incr.result);
    const resetAt = (windowId + 1) * windowMs;
    return { success: count <= limit, limit, remaining: Math.max(0, limit - count), resetAt };
  }
}

let limiter: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (limiter) return limiter;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  limiter = url && token ? new UpstashRateLimiter(url, token) : new MemoryRateLimiter();
  return limiter;
}

export function setRateLimiterForTests(l: RateLimiter | null) {
  limiter = l;
}
