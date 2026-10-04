import "server-only";
import { PublicKey } from "@solana/web3.js";
import { getVerifiedConnection } from "./connection";

/**
 * SOL/USD read directly from Pyth's on-chain price feed account (no third-party
 * HTTP API). The account is checked to be owned by the Pyth Solana Receiver,
 * fully verified, for the SOL/USD feed, fresh and tight before it is used to
 * quote a payment.
 */
const SOL_USD_FEED_ID = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
// Pyth sponsored SOL/USD price feed account (same address on mainnet and devnet).
const SOL_USD_ACCOUNT = new PublicKey("7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE");
const PYTH_RECEIVER = "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ";
const MAX_AGE_SECONDS = 120;
const MAX_CONF_RATIO = 0.02;

export class PriceUnavailableError extends Error {}

export interface PythPrice {
  feedId: string;
  fullyVerified: boolean;
  price: number;
  conf: number;
  publishTime: number;
}

/** Decode a Pyth PriceUpdateV2 account. */
export function decodePriceUpdateV2(data: Uint8Array): PythPrice {
  const buf = Buffer.from(data);
  let o = 8 + 32; // discriminator, write authority
  const tag = buf[o]; // VerificationLevel: 0 = Partial { num_signatures: u8 }, 1 = Full
  o += tag === 0 ? 2 : 1;
  const feedId = buf.subarray(o, o + 32).toString("hex");
  o += 32;
  const price = buf.readBigInt64LE(o);
  o += 8;
  const conf = buf.readBigUInt64LE(o);
  o += 8;
  const expo = buf.readInt32LE(o);
  o += 4;
  const publishTime = Number(buf.readBigInt64LE(o));
  const scale = 10 ** expo;
  return { feedId, fullyVerified: tag === 1, price: Number(price) * scale, conf: Number(conf) * scale, publishTime };
}

export function validateSolUsd(p: PythPrice, nowSeconds = Date.now() / 1000): number {
  if (p.feedId !== SOL_USD_FEED_ID) throw new PriceUnavailableError("Unexpected price feed");
  if (!p.fullyVerified) throw new PriceUnavailableError("SOL price update is not fully verified");
  if (!(p.price > 0)) throw new PriceUnavailableError("Invalid SOL price");
  if (nowSeconds - p.publishTime > MAX_AGE_SECONDS) throw new PriceUnavailableError("SOL price is stale; try again shortly");
  if (p.conf / p.price > MAX_CONF_RATIO) throw new PriceUnavailableError("SOL price is too uncertain right now; try again shortly");
  return p.price;
}

let cache: { price: number; at: number } | null = null;

export async function getSolUsdPrice(): Promise<number> {
  if (cache && Date.now() - cache.at < 15_000) return cache.price;
  const conn = await getVerifiedConnection();
  const account = await conn.getAccountInfo(SOL_USD_ACCOUNT, "confirmed").catch(() => null);
  if (!account) throw new PriceUnavailableError("SOL price feed unavailable");
  if (account.owner.toBase58() !== PYTH_RECEIVER) throw new PriceUnavailableError("SOL price account has an unexpected owner");
  const price = validateSolUsd(decodePriceUpdateV2(account.data));
  cache = { price, at: Date.now() };
  return price;
}
