import "server-only";
import { PublicKey } from "@solana/web3.js";
import { getVerifiedConnection } from "@/lib/solana/connection";
import { getSolUsdPrice } from "@/lib/solana/price";
import { getBondingCurveState, getPumpCoin, getPumpSwapPool } from "@/lib/solana/pump";
import { env } from "@/server/env";

export interface TokenInfo {
  configured: boolean;
  network: string;
  mint: string | null;
  name: string;
  symbol: string;
  onChain: {
    standard: string;
    decimals: number;
    supply: string;
    mintAuthority: string | null;
    freezeAuthority: string | null;
    metadataUri: string | null;
  } | null;
  status: "not_configured" | "not_found" | "bonding_curve" | "graduated" | "unknown";
  bondingCurve: { address: string; progressPct: number; complete: boolean } | null;
  pool: { address: string } | null;
  priceSol: number | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
  /** Share of supply held by the 10 largest token accounts (includes curve/pool accounts). */
  top10SharePct: number | null;
  fetchedAt: string;
  errors: string[];
}

let cache: { at: number; value: TokenInfo } | null = null;

/** Live token data. Every field is read from chain or a price feed; missing data stays null — never invented. */
export async function getTokenInfo(): Promise<TokenInfo> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const e = env();
  const base: TokenInfo = {
    configured: Boolean(e.PROJECT_TOKEN_MINT),
    network: e.SOLANA_NETWORK,
    mint: e.PROJECT_TOKEN_MINT ?? null,
    name: e.PROJECT_TOKEN_NAME,
    symbol: e.PROJECT_TOKEN_SYMBOL,
    onChain: null,
    status: e.PROJECT_TOKEN_MINT ? "unknown" : "not_configured",
    bondingCurve: null,
    pool: null,
    priceSol: null,
    priceUsd: null,
    marketCapUsd: null,
    top10SharePct: null,
    fetchedAt: new Date().toISOString(),
    errors: [],
  };
  if (!e.PROJECT_TOKEN_MINT) return base;
  const mint = e.PROJECT_TOKEN_MINT;

  try {
    const coin = await getPumpCoin(mint);
    base.onChain = {
      standard: coin.standard,
      decimals: coin.decimals,
      supply: coin.supply.toString(),
      mintAuthority: coin.mintAuthority,
      freezeAuthority: coin.freezeAuthority,
      metadataUri: coin.uri,
    };
    if (coin.name) base.name = coin.name;
    if (coin.symbol) base.symbol = coin.symbol;
  } catch (err) {
    base.status = "not_found";
    base.errors.push(`Mint: ${(err as Error).message}`);
    cache = { at: Date.now(), value: base };
    return base;
  }

  const [curve, pool, solUsd] = await Promise.all([
    getBondingCurveState(mint).catch((err) => (base.errors.push(`Curve: ${err.message}`), null)),
    getPumpSwapPool(mint).catch(() => null),
    getSolUsdPrice().catch((err) => (base.errors.push(`Price: ${err.message}`), null)),
  ]);

  if (curve) base.bondingCurve = { address: curve.address, progressPct: curve.progressPct, complete: curve.complete };
  if (pool) base.pool = { address: pool.address };
  base.status = curve && !curve.complete ? "bonding_curve" : pool || curve?.complete ? "graduated" : "not_found";

  const pricePerTokenLamports = curve && !curve.complete ? curve.priceQuotePerToken : pool?.priceQuotePerToken;
  if (pricePerTokenLamports) {
    base.priceSol = pricePerTokenLamports / 1e9;
    if (solUsd) base.priceUsd = base.priceSol * solUsd;
    const supply = Number(base.onChain!.supply) / 10 ** base.onChain!.decimals;
    if (base.priceUsd) base.marketCapUsd = base.priceUsd * supply;
  }

  try {
    const conn = await getVerifiedConnection();
    const largest = await conn.getTokenLargestAccounts(new PublicKey(mint));
    const supply = BigInt(base.onChain!.supply);
    if (supply > 0n) {
      const top = largest.value.slice(0, 10).reduce((n, a) => n + BigInt(a.amount), 0n);
      base.top10SharePct = Number((top * 10_000n) / supply) / 100;
    }
  } catch {
    // Many public RPCs rate-limit this call; leave it null rather than guess.
  }

  cache = { at: Date.now(), value: base };
  return base;
}
