import "server-only";

/**
 * SOL/USD from the Pyth Hermes API. Quotes are rejected when the price is
 * stale or its confidence interval is wide, rather than charging users a bad rate.
 */
const SOL_USD_FEED = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
const MAX_AGE_SECONDS = 120;
const MAX_CONF_RATIO = 0.02;

let cache: { price: number; at: number } | null = null;

export class PriceUnavailableError extends Error {}

export async function getSolUsdPrice(): Promise<number> {
  if (cache && Date.now() - cache.at < 15_000) return cache.price;
  const res = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=${SOL_USD_FEED}&parsed=true`, {
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) throw new PriceUnavailableError("SOL price feed unavailable");
  const json = (await res.json()) as {
    parsed?: Array<{ price: { price: string; conf: string; expo: number; publish_time: number } }>;
  };
  const p = json.parsed?.[0]?.price;
  if (!p) throw new PriceUnavailableError("SOL price feed returned no data");
  const scale = 10 ** p.expo;
  const price = Number(p.price) * scale;
  const conf = Number(p.conf) * scale;
  const age = Date.now() / 1000 - p.publish_time;
  if (!(price > 0) || age > MAX_AGE_SECONDS || conf / price > MAX_CONF_RATIO) {
    throw new PriceUnavailableError("SOL price is stale or uncertain right now; try again shortly");
  }
  cache = { price, at: Date.now() };
  return price;
}
