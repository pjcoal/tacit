import "server-only";
import { getAccount, getMint } from "@solana/spl-token";
import { Keypair, PublicKey, type ParsedTransactionWithMeta } from "@solana/web3.js";
import { and, desc, eq, gt } from "drizzle-orm";
import { creditsForPackage, planPriceUsd, usdToBaseUnits, type PaymentCurrency } from "@/lib/credits/calc";
import { buildPaymentTransaction, paymentDestination } from "@/lib/payments/transaction";
import { validatePaymentTransaction } from "@/lib/payments/verify";
import { getVerifiedConnection } from "@/lib/solana/connection";
import { getSolUsdPrice } from "@/lib/solana/price";
import type { Db } from "@/server/db/client";
import { creditLedger, paymentIntents, payments, subscriptions } from "@/server/db/schema";
import { env } from "@/server/env";
import { HttpError } from "@/server/http";
import { getPlans } from "@/server/public-config";
import { getTokenInfo } from "./token-info";
import { MAX_TX_VERSION } from "@/lib/solana/constants";

export type ProductKind = "credits" | "plan";

export interface ProductQuote {
  kind: ProductKind;
  productId: string;
  usd: number;
  credits: number;
  planId?: "pro" | "max";
}

/** Resolve what is being bought and its USD price; all amounts come from configuration. */
export function quoteProduct(kind: ProductKind, productId: string, currency: PaymentCurrency): ProductQuote {
  const e = env();
  if (kind === "credits") {
    const m = /^credits_(\d+(?:\.\d{1,2})?)$/.exec(productId);
    const usd = m ? Number(m[1]) : NaN;
    if (!e.CREDIT_PACKAGES_USD.includes(usd)) throw new HttpError(400, "Unknown credit package", "unknown_product");
    const { total } = creditsForPackage({ usd, currency, creditsPerUsd: e.CREDITS_PER_USD, tokenBonusBps: e.TOKEN_CREDIT_BONUS_BPS });
    return { kind, productId, usd, credits: total };
  }
  const plan = getPlans().find((p) => p.id === productId && p.id !== "free");
  if (!plan) throw new HttpError(400, "Unknown plan", "unknown_product");
  return {
    kind,
    productId,
    usd: planPriceUsd(plan.priceUsd, currency, e.TOKEN_PLAN_DISCOUNT_BPS),
    credits: plan.includedCredits,
    planId: plan.id as "pro" | "max",
  };
}

interface Asset {
  currency: PaymentCurrency;
  unitPriceUsd: number;
  decimals: number;
  spl?: { mint: PublicKey; decimals: number; programId: PublicKey };
}

async function resolveAsset(currency: PaymentCurrency): Promise<Asset> {
  const e = env();
  const conn = await getVerifiedConnection();
  if (currency === "SOL") {
    return { currency, unitPriceUsd: await getSolUsdPrice().catch((err) => { throw new HttpError(503, err.message, "price_unavailable"); }), decimals: 9 };
  }
  const mintStr = currency === "USDC" ? e.usdcMint : e.PROJECT_TOKEN_MINT;
  if (!mintStr) throw new HttpError(503, "The project token has not launched yet.", "token_not_configured");
  const mint = new PublicKey(mintStr);
  const acct = await conn.getAccountInfo(mint);
  if (!acct) throw new HttpError(503, `${currency} mint not found on ${e.SOLANA_NETWORK}`, "mint_not_found");
  const info = await getMint(conn, mint, "confirmed", acct.owner);
  let unitPriceUsd = 1; // USDC is treated as $1.00
  if (currency === "TOKEN") {
    const token = await getTokenInfo();
    if (!token.priceUsd) throw new HttpError(503, "Token price is unavailable right now, so we can't quote it fairly.", "price_unavailable");
    unitPriceUsd = token.priceUsd;
  }
  return { currency, unitPriceUsd, decimals: info.decimals, spl: { mint, decimals: info.decimals, programId: acct.owner } };
}

export async function createPaymentIntent(
  db: Db,
  accountId: string,
  input: { kind: ProductKind; productId: string; currency: PaymentCurrency; payer: string },
) {
  const e = env();
  if (!e.TREASURY_WALLET) throw new HttpError(503, "Payments are not configured (no treasury wallet).", "payments_not_configured");
  const product = quoteProduct(input.kind, input.productId, input.currency);
  const asset = await resolveAsset(input.currency);
  const amount = usdToBaseUnits(product.usd, asset.unitPriceUsd, asset.decimals);
  const payer = new PublicKey(input.payer);
  const treasury = new PublicKey(e.TREASURY_WALLET);
  if (payer.equals(treasury)) throw new HttpError(400, "The treasury wallet can't buy credits from itself.", "invalid_payer");

  const conn = await getVerifiedConnection();
  // Friendly pre-check; the chain enforces it regardless.
  if (asset.spl) {
    const source = paymentDestination(payer, asset.spl);
    const bal = await getAccount(conn, source, "confirmed", asset.spl.programId).catch(() => null);
    if (!bal || bal.amount < amount) throw new HttpError(400, `Insufficient ${input.currency} balance in this wallet.`, "insufficient_funds");
  } else {
    const lamports = await conn.getBalance(payer, "confirmed");
    if (BigInt(lamports) < amount + 10_000n) throw new HttpError(400, "Insufficient SOL balance in this wallet.", "insufficient_funds");
  }

  const reference = Keypair.generate().publicKey;
  const destination = paymentDestination(treasury, asset.spl);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const tx = buildPaymentTransaction({ payer, treasury, reference, amount, recentBlockhash: blockhash, lastValidBlockHeight, spl: asset.spl });
  const expiresAt = new Date(Date.now() + e.PAYMENT_INTENT_TTL_SECONDS * 1000);

  const [intent] = await db
    .insert(paymentIntents)
    .values({
      accountId,
      kind: input.kind,
      productId: input.productId,
      currency: input.currency,
      mint: asset.spl?.mint.toBase58() ?? null,
      tokenProgram: asset.spl?.programId.toBase58() ?? null,
      payer: payer.toBase58(),
      treasury: treasury.toBase58(),
      destination: destination.toBase58(),
      amountBaseUnits: amount.toString(),
      usdAmount: product.usd.toFixed(4),
      unitPriceUsd: asset.unitPriceUsd.toFixed(12),
      credits: product.credits,
      reference: reference.toBase58(),
      expiresAt,
    })
    .returning();

  return {
    intent: {
      id: intent.id,
      kind: intent.kind,
      productId: intent.productId,
      currency: intent.currency,
      amountBaseUnits: intent.amountBaseUnits,
      decimals: asset.decimals,
      usd: product.usd,
      unitPriceUsd: asset.unitPriceUsd,
      credits: product.credits,
      destination: intent.destination,
      expiresAt: intent.expiresAt,
    },
    transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"),
  };
}

export class ReplayError extends HttpError {
  constructor() {
    super(409, "This transaction has already been used for another payment.", "replay");
  }
}

function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err; e; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: string }).code === "23505") return true;
  }
  return false;
}

/**
 * Atomically mark the intent complete, record the payment and issue credits.
 * Guarantees: an intent is fulfilled at most once (status guard + unique
 * intent_id), and a signature redeems at most one intent (unique signature).
 */
export async function fulfillPayment(
  db: Db,
  intentId: string,
  proof: { signature: string; amount: bigint; slot: number; commitment: string },
): Promise<{ status: "completed" | "already_completed"; credits: number }> {
  try {
    return await db.transaction(async (tx) => {
      const [intent] = await tx
        .update(paymentIntents)
        .set({ status: "completed", completedAt: new Date() })
        .where(and(eq(paymentIntents.id, intentId), eq(paymentIntents.status, "pending")))
        .returning();

      if (!intent) {
        const [existing] = await tx.select().from(payments).where(eq(payments.intentId, intentId)).limit(1);
        if (existing && existing.signature === proof.signature) {
          const [i] = await tx.select({ credits: paymentIntents.credits }).from(paymentIntents).where(eq(paymentIntents.id, intentId));
          return { status: "already_completed" as const, credits: i?.credits ?? 0 };
        }
        throw new HttpError(409, "This payment request is no longer pending.", "intent_not_pending");
      }

      const [payment] = await tx
        .insert(payments)
        .values({
          intentId: intent.id,
          accountId: intent.accountId,
          signature: proof.signature,
          payer: intent.payer,
          currency: intent.currency,
          mint: intent.mint,
          amountBaseUnits: proof.amount.toString(),
          usdAmount: intent.usdAmount,
          slot: proof.slot,
          commitment: proof.commitment,
        })
        .returning();

      await tx.insert(creditLedger).values({
        accountId: intent.accountId,
        delta: intent.credits,
        reason: intent.kind === "plan" ? "plan_grant" : "purchase",
        refType: "payment",
        refId: payment.id,
      });

      if (intent.kind === "plan") {
        const [current] = await tx
          .select()
          .from(subscriptions)
          .where(and(eq(subscriptions.accountId, intent.accountId), gt(subscriptions.endsAt, new Date())))
          .orderBy(desc(subscriptions.endsAt))
          .limit(1);
        // Fixed-duration access. Buying again extends from the current end date; nothing renews automatically.
        const startsAt = current && current.plan === intent.productId ? current.endsAt : new Date();
        const days = getPlans().find((p) => p.id === intent.productId)?.durationDays ?? 30;
        await tx.insert(subscriptions).values({
          accountId: intent.accountId,
          plan: intent.productId as "pro" | "max",
          paymentId: payment.id,
          startsAt,
          endsAt: new Date(startsAt.getTime() + days * 86_400_000),
        });
      }
      return { status: "completed" as const, credits: intent.credits };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new ReplayError();
    throw err;
  }
}

export type TxFetcher = (signature: string, commitment: "confirmed" | "finalized") => Promise<ParsedTransactionWithMeta | null>;

const GRACE_MS = 90_000;

/**
 * Verify a submitted signature against an intent and fulfil it.
 * Returns "pending" while the transaction hasn't reached the required commitment.
 */
export async function verifyAndFulfill(
  db: Db,
  accountId: string,
  intentId: string,
  signature: string,
  fetchTx: TxFetcher,
  commitment: "confirmed" | "finalized",
): Promise<{ status: "completed" | "already_completed" | "pending"; credits?: number }> {
  const [intent] = await db.select().from(paymentIntents).where(eq(paymentIntents.id, intentId)).limit(1);
  if (!intent || intent.accountId !== accountId) throw new HttpError(404, "Payment request not found", "not_found");
  if (intent.status === "completed") {
    const [p] = await db.select().from(payments).where(eq(payments.intentId, intentId)).limit(1);
    if (p?.signature === signature) return { status: "already_completed", credits: intent.credits };
    throw new HttpError(409, "This payment request was already fulfilled by a different transaction.", "intent_not_pending");
  }

  // Cheap replay check before hitting the RPC (the unique index is the real guarantee).
  const [used] = await db.select({ id: payments.id }).from(payments).where(eq(payments.signature, signature)).limit(1);
  if (used) throw new ReplayError();

  const tx = await fetchTx(signature, commitment);
  if (!tx) {
    if (Date.now() > intent.expiresAt.getTime() + 10 * 60_000) {
      await db.update(paymentIntents).set({ status: "expired" }).where(and(eq(paymentIntents.id, intentId), eq(paymentIntents.status, "pending")));
      throw new HttpError(410, "This payment request expired before the transaction was found.", "expired");
    }
    return { status: "pending" };
  }

  const check = validatePaymentTransaction(tx, {
    kind: intent.mint ? "SPL" : "SOL",
    payer: intent.payer,
    destination: intent.destination,
    mint: intent.mint ?? undefined,
    minAmount: BigInt(intent.amountBaseUnits),
    reference: intent.reference,
    notBefore: new Date(intent.createdAt.getTime() - GRACE_MS),
    notAfter: new Date(intent.expiresAt.getTime() + GRACE_MS),
  });
  if (!check.ok) throw new HttpError(400, `Payment could not be verified: ${check.reason}`, "verification_failed");

  return fulfillPayment(db, intentId, { signature, amount: check.amount, slot: check.slot, commitment });
}

export const rpcTxFetcher: TxFetcher = async (signature, commitment) => {
  const conn = await getVerifiedConnection();
  return conn.getParsedTransaction(signature, { commitment, maxSupportedTransactionVersion: MAX_TX_VERSION });
};
