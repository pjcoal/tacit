import "server-only";
import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { getRateLimiter, type RateLimitResult } from "@/lib/security/rate-limit";
import { env } from "@/server/env";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "error",
    public headers: Record<string, string> = {},
  ) {
    super(message);
  }
}

export function jsonError(status: number, message: string, code = "error", headers: Record<string, string> = {}) {
  return NextResponse.json({ error: message, code }, { status, headers: { "cache-control": "no-store", ...headers } });
}

/** Wrap a route handler: maps HttpError/ZodError to JSON and hides internal errors. */
export function route<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof HttpError) return jsonError(err.status, err.message, err.code, err.headers);
      if (err instanceof ZodError) {
        return jsonError(400, err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "), "invalid_request");
      }
      console.error("[route] unhandled error", err);
      return jsonError(500, "Internal error", "internal");
    }
  };
}

const MAX_JSON_BYTES = 12 * 1024 * 1024;

export async function parseJson<T>(req: Request, schema: ZodType<T>, maxBytes = MAX_JSON_BYTES): Promise<T> {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) throw new HttpError(415, "Expected application/json", "unsupported_media_type");
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > maxBytes) throw new HttpError(413, "Request body too large", "payload_too_large");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request body too large", "payload_too_large");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON", "invalid_json");
  }
  return schema.parse(data);
}

/** Client IP as seen by the edge. Only used (hashed) for rate limiting; never stored. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** A keyed, day-rotating hash of the IP: usable for quotas, useless for tracking across days. */
export function ipKey(req: Request): string {
  const day = new Date().toISOString().slice(0, 10);
  return createHmac("sha256", env().serverSecret).update(`${day}:${clientIp(req)}`).digest("base64url").slice(0, 22);
}

export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  return {
    "x-ratelimit-limit": String(r.limit),
    "x-ratelimit-remaining": String(r.remaining),
    "x-ratelimit-reset": String(Math.ceil(r.resetAt / 1000)),
  };
}

export async function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const r = await getRateLimiter().limit(key, limit, windowMs);
  if (!r.success) {
    throw new HttpError(429, "Too many requests. Please slow down.", "rate_limited", {
      ...rateLimitHeaders(r),
      "retry-after": String(Math.max(1, Math.ceil((r.resetAt - Date.now()) / 1000))),
    });
  }
  return r;
}

/** Reject cross-site state-changing requests (defence in depth on top of SameSite cookies). */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new HttpError(403, "Cross-origin request rejected", "forbidden");
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(403, "Bad origin", "forbidden");
  }
}
