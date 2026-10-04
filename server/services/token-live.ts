import "server-only";
import { PublicKey } from "@solana/web3.js";
import { getVerifiedConnection } from "@/lib/solana/connection";
import { env } from "@/server/env";

/**
 * Whether the configured token mint exists on-chain yet. The contract address
 * can be published before launch; until the mint account exists, the site
 * stays in pre-launch mode (no buy button, no burn payments, no trading links).
 * Once seen, it is remembered for the life of the server instance.
 */
let state: { mint: string; live: boolean; checkedAt: number } | null = null;
let inflight: Promise<void> | null = null;
const RECHECK_MS = 60_000;
const TIMEOUT_MS = 2_500;

export function isTokenLive(): boolean {
  const mint = env().PROJECT_TOKEN_MINT;
  return Boolean(mint && state?.mint === mint && state.live);
}

export async function refreshTokenLive(): Promise<void> {
  const mint = env().PROJECT_TOKEN_MINT;
  if (!mint) return;
  if (state?.mint === mint && (state.live || Date.now() - state.checkedAt < RECHECK_MS)) return;
  inflight ??= (async () => {
    try {
      const conn = await getVerifiedConnection();
      const info = await Promise.race([
        conn.getAccountInfo(new PublicKey(mint), "confirmed"),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)),
      ]);
      state = { mint, live: Boolean(info), checkedAt: Date.now() };
    } catch {
      // RPC trouble: keep the last answer and try again later.
      state = { mint, live: state?.mint === mint ? state.live : false, checkedAt: Date.now() };
    } finally {
      inflight = null;
    }
  })();
  await inflight;
}
