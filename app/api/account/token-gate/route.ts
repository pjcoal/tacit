import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getVerifiedConnection } from "@/lib/solana/connection";
import { requireAccount } from "@/server/auth/account";
import { requestHost, verifyProof } from "@/server/auth/wallet-proof";
import { getDb } from "@/server/db/client";
import { accounts } from "@/server/db/schema";
import { env } from "@/server/env";
import { assertSameOrigin, enforceRateLimit, HttpError, parseJson, route } from "@/server/http";

export const runtime = "nodejs";

const schema = z.object({ publicKey: z.string(), signature: z.string().max(200), message: z.string().max(2000) });

/**
 * Token-gated benefits: prove wallet ownership with a signed message, we read
 * the token balance, and store only "holder until <time>" on the account —
 * not the wallet address.
 */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const account = await requireAccount(req);
  await enforceRateLimit(`token-gate:${account.id}`, 10, 60 * 60_000);
  const e = env();
  if (!e.PROJECT_TOKEN_MINT) throw new HttpError(503, "The project token has not launched yet.", "token_not_configured");
  if (!(e.TOKEN_GATE_HOLDER_MIN > 0)) throw new HttpError(503, "Token-gated benefits are not configured.", "not_configured");

  const body = await parseJson(req, schema, 4096);
  const db = await getDb();
  const wallet = await verifyProof(db, "token_gate", body, requestHost(req));

  const conn = await getVerifiedConnection();
  const mint = new PublicKey(e.PROJECT_TOKEN_MINT);
  const mintInfo = await conn.getAccountInfo(mint);
  if (!mintInfo) throw new HttpError(503, "Token mint not found", "mint_not_found");
  const accts = await conn.getParsedTokenAccountsByOwner(new PublicKey(wallet), { mint }, "confirmed");
  const held = accts.value.reduce((n, a) => n + Number(a.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);

  if (held < e.TOKEN_GATE_HOLDER_MIN) {
    return NextResponse.json({ tier: null, held, required: e.TOKEN_GATE_HOLDER_MIN });
  }
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.update(accounts).set({ tokenTier: "holder", tokenTierExpiresAt: expiresAt }).where(eq(accounts.id, account.id));
  return NextResponse.json({ tier: "holder", held, required: e.TOKEN_GATE_HOLDER_MIN, expiresAt });
});
