import { NextResponse } from "next/server";
import { z } from "zod";
import { isBase58Signature64 } from "@/lib/solana/address";
import { getVerifiedConnection } from "@/lib/solana/connection";
import { getDb } from "@/server/db/client";
import { tokenPurchases } from "@/server/db/schema";
import { assertSameOrigin, enforceRateLimit, HttpError, ipKey, parseJson, route } from "@/server/http";
import { requireTokenMint } from "@/server/token-schemas";
import { MAX_TX_VERSION } from "@/lib/solana/constants";

export const runtime = "nodejs";

const schema = z.object({
  signature: z.string().refine(isBase58Signature64, "invalid signature"),
  venue: z.enum(["bonding_curve", "pumpswap"]),
});

/**
 * Optional analytics for purchases made through the Buy modal: we record the
 * signature and amounts read from chain — not the wallet address.
 */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await enforceRateLimit(`token-purchase:${ipKey(req)}`, 20, 60_000);
  const mint = requireTokenMint();
  const { signature, venue } = await parseJson(req, schema, 2048);
  const conn = await getVerifiedConnection();
  const tx = await conn.getParsedTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: MAX_TX_VERSION });
  if (!tx?.meta || tx.meta.err) throw new HttpError(400, "Transaction not found or failed", "invalid_transaction");

  const payer = tx.transaction.message.accountKeys[0]?.pubkey.toBase58();
  const solSpent = BigInt(tx.meta.preBalances[0] - tx.meta.postBalances[0]);
  const before = tx.meta.preTokenBalances?.find((b) => b.mint === mint && b.owner === payer);
  const after = tx.meta.postTokenBalances?.find((b) => b.mint === mint && b.owner === payer);
  const tokenDelta = BigInt(after?.uiTokenAmount.amount ?? "0") - BigInt(before?.uiTokenAmount.amount ?? "0");
  if (tokenDelta <= 0n) throw new HttpError(400, "Transaction did not acquire the project token", "invalid_transaction");

  await (await getDb())
    .insert(tokenPurchases)
    .values({ signature, venue, quoteAmountBaseUnits: solSpent.toString(), tokenAmountBaseUnits: tokenDelta.toString(), verified: true })
    .onConflictDoNothing();
  return NextResponse.json({ ok: true });
});
