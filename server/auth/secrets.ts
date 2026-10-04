import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Bearer secrets (account keys, API keys) are 256-bit random values, so a
 * plain SHA-256 is sufficient for at-rest storage — there is nothing to brute
 * force. Only the hash is persisted; the secret is shown to the user once.
 */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(prefix: string, bytes = 32): string {
  return `${prefix}${randomBytes(bytes).toString("base64url")}`;
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export const ACCOUNT_SECRET_PREFIX = "veil_acct_";
export const API_KEY_PREFIX = "veil_sk_";

const ACCOUNT_RE = /^veil_acct_[A-Za-z0-9_-]{43}$/;
const API_KEY_RE = /^veil_sk_[A-Za-z0-9_-]{43}$/;

export const isAccountSecret = (s: string) => ACCOUNT_RE.test(s);
export const isApiKey = (s: string) => API_KEY_RE.test(s);
