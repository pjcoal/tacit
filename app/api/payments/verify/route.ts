import { NextResponse } from "next/server";
import { z } from "zod";
import { isBase58Signature64 } from "@/lib/solana/address";
import { requireAccount } from "@/server/auth/account";
import { getDb } from "@/server/db/client";
import { env } from "@/server/env";
import { assertSameOrigin, enforceRateLimit, parseJson, route } from "@/server/http";
import { getBalance } from "@/server/services/ledger";
import { rpcTxFetcher, verifyAndFulfill } from "@/server/services/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  intentId: z.uuid(),
  signature: z.string().refine(isBase58Signature64, "invalid transaction signature"),
});

/**
 * The only path that issues purchased credits: fetch the transaction from
 * the chain at the configured commitment, validate it, then fulfil atomically.
 */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const account = await requireAccount(req);
  await enforceRateLimit(`pay-verify:${account.id}`, 60, 60_000);
  const { intentId, signature } = await parseJson(req, schema, 2048);
  const db = await getDb();
  const result = await verifyAndFulfill(db, account.id, intentId, signature, rpcTxFetcher, env().paymentCommitment);
  if (result.status === "pending") {
    return NextResponse.json({ status: "pending", commitment: env().paymentCommitment }, { status: 202 });
  }
  return NextResponse.json({ ...result, balance: await getBalance(db, account.id) });
});
