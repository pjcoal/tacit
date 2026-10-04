import "server-only";
import { createBurnCheckedInstruction, getAssociatedTokenAddressSync, getMint } from "@solana/spl-token";
import { ComputeBudgetProgram, PublicKey, Transaction } from "@solana/web3.js";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { getVerifiedConnection } from "@/lib/solana/connection";
import { getSolUsdPrice } from "@/lib/solana/price";
import { prepareBuyTransaction } from "@/lib/solana/pump";
import type { Db } from "@/server/db/client";
import { buybackExecutions, buybackProposals, payments, usageRecords } from "@/server/db/schema";
import { env } from "@/server/env";
import { HttpError } from "@/server/http";
import { MAX_TX_VERSION } from "@/lib/solana/constants";

/**
 * Buyback & burn are strictly admin-driven:
 *   ledger → proposal → human review → unsigned tx → treasury wallet signs → on-chain verification → log.
 * Nothing here signs, schedules or submits a transaction on its own.
 */

export async function revenueBetween(db: Db, start: Date, end: Date) {
  const [g] = await db
    .select({ total: sql<string>`coalesce(sum(${payments.usdAmount}), 0)` })
    .from(payments)
    .where(and(gte(payments.createdAt, start), lt(payments.createdAt, end)));
  const [c] = await db
    .select({ total: sql<string>`coalesce(sum(${usageRecords.providerCostUsd}), 0)` })
    .from(usageRecords)
    .where(and(gte(usageRecords.createdAt, start), lt(usageRecords.createdAt, end)));
  const gross = Number(g.total);
  const providerCost = Number(c.total);
  return { gross, providerCost, net: Math.max(0, gross - providerCost) };
}

export async function nextPeriodStart(db: Db): Promise<Date> {
  const [last] = await db.select().from(buybackProposals).where(sql`${buybackProposals.status} <> 'rejected'`).orderBy(desc(buybackProposals.periodEnd)).limit(1);
  if (last) return last.periodEnd;
  const [first] = await db.select({ at: payments.createdAt }).from(payments).orderBy(payments.createdAt).limit(1);
  return first?.at ?? new Date(Date.now() - 30 * 86_400_000);
}

export async function createProposal(db: Db, admin: string, notes?: string) {
  const e = env();
  if (!e.PROJECT_TOKEN_MINT) throw new HttpError(400, "PROJECT_TOKEN_MINT is not set", "token_not_configured");
  const start = await nextPeriodStart(db);
  const end = new Date();
  const rev = await revenueBetween(db, start, end);
  const proposedUsd = (rev.net * e.BUYBACK_ALLOCATION_BPS) / 10_000;
  if (proposedUsd <= 0) throw new HttpError(400, "No net revenue to allocate in this period.", "nothing_to_propose");
  const [row] = await db
    .insert(buybackProposals)
    .values({
      periodStart: start,
      periodEnd: end,
      grossRevenueUsd: rev.gross.toFixed(4),
      providerCostUsd: rev.providerCost.toFixed(4),
      netRevenueUsd: rev.net.toFixed(4),
      allocationBps: e.BUYBACK_ALLOCATION_BPS,
      proposedUsd: proposedUsd.toFixed(4),
      createdBy: admin,
      notes: notes ?? null,
    })
    .returning();
  return row;
}

export async function reviewProposal(db: Db, id: string, admin: string, action: "approve" | "reject", notes?: string) {
  const [row] = await db
    .update(buybackProposals)
    .set({ status: action === "approve" ? "approved" : "rejected", reviewedBy: admin, reviewedAt: new Date(), ...(notes ? { notes } : {}) })
    .where(and(eq(buybackProposals.id, id), eq(buybackProposals.status, "proposed")))
    .returning();
  if (!row) throw new HttpError(409, "Proposal is not awaiting review", "invalid_state");
  return row;
}

function treasury(): PublicKey {
  const t = env().TREASURY_WALLET;
  if (!t) throw new HttpError(503, "TREASURY_WALLET is not set", "not_configured");
  return new PublicKey(t);
}

/** Unsigned buy transaction with the treasury as fee payer and buyer; only the treasury wallet can sign it. */
export async function prepareBuyback(db: Db, proposalId: string, slippagePct: number) {
  const e = env();
  const [p] = await db.select().from(buybackProposals).where(eq(buybackProposals.id, proposalId)).limit(1);
  if (!p) throw new HttpError(404, "Proposal not found", "not_found");
  if (p.status !== "approved") throw new HttpError(409, "Proposal must be approved before execution", "invalid_state");
  const solUsd = await getSolUsdPrice();
  const lamports = BigInt(Math.floor((Number(p.proposedUsd) / solUsd) * 1e9));
  if (lamports < 1_000_000n) throw new HttpError(400, "Proposed amount is below 0.001 SOL", "too_small");
  const built = await prepareBuyTransaction({ mint: e.PROJECT_TOKEN_MINT!, user: treasury().toBase58(), lamports, slippagePct });
  return { ...built, lamports: lamports.toString(), solUsd };
}

export async function prepareBurn(amountUi: number) {
  const e = env();
  if (!e.PROJECT_TOKEN_MINT) throw new HttpError(400, "PROJECT_TOKEN_MINT is not set", "token_not_configured");
  const conn = await getVerifiedConnection();
  const mint = new PublicKey(e.PROJECT_TOKEN_MINT);
  const owner = treasury();
  const mintAcct = await conn.getAccountInfo(mint);
  if (!mintAcct) throw new HttpError(404, "Mint not found", "not_found");
  const info = await getMint(conn, mint, "confirmed", mintAcct.owner);
  const amount = BigInt(Math.round(amountUi * 10 ** info.decimals));
  if (amount <= 0n) throw new HttpError(400, "Amount must be positive", "invalid_request");
  const source = getAssociatedTokenAddressSync(mint, owner, true, mintAcct.owner);
  const balance = await conn.getTokenAccountBalance(source).catch(() => null);
  if (!balance || BigInt(balance.value.amount) < amount) throw new HttpError(400, "Treasury doesn't hold that many tokens", "insufficient_funds");

  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight });
  // A real SPL burn: supply decreases on-chain (not a transfer to a "dead" address).
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 }), createBurnCheckedInstruction(source, mint, owner, amount, info.decimals, [], mintAcct.owner));
  return {
    transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"),
    amount: amount.toString(),
    decimals: info.decimals,
  };
}

/** Verify a treasury-signed transaction on-chain and append it to the execution log. */
export async function recordExecution(db: Db, input: { kind: "buy" | "burn"; signature: string; proposalId?: string; admin: string }) {
  const e = env();
  const mint = e.PROJECT_TOKEN_MINT!;
  const owner = treasury().toBase58();
  const conn = await getVerifiedConnection();
  const tx = await conn.getParsedTransaction(input.signature, { commitment: "confirmed", maxSupportedTransactionVersion: MAX_TX_VERSION });
  if (!tx?.meta) throw new HttpError(404, "Transaction not found yet; try again in a few seconds", "not_found");

  const keys = tx.transaction.message.accountKeys;
  const signedByTreasury = keys.some((k) => k.signer && k.pubkey.toBase58() === owner);
  let status: "verified" | "failed" = tx.meta.err ? "failed" : "verified";
  let error: string | null = tx.meta.err ? JSON.stringify(tx.meta.err) : null;
  if (!signedByTreasury) {
    status = "failed";
    error = "Not signed by the treasury wallet";
  }

  const pre = tx.meta.preTokenBalances?.find((b) => b.mint === mint && b.owner === owner);
  const post = tx.meta.postTokenBalances?.find((b) => b.mint === mint && b.owner === owner);
  const tokenDelta = BigInt(post?.uiTokenAmount.amount ?? "0") - BigInt(pre?.uiTokenAmount.amount ?? "0");
  const treasuryIndex = keys.findIndex((k) => k.pubkey.toBase58() === owner);
  const solSpent = treasuryIndex >= 0 ? BigInt(tx.meta.preBalances[treasuryIndex] - tx.meta.postBalances[treasuryIndex]) : null;

  if (status === "verified" && input.kind === "buy" && tokenDelta <= 0n) {
    status = "failed";
    error = "Treasury token balance did not increase";
  }
  if (status === "verified" && input.kind === "burn" && tokenDelta >= 0n) {
    status = "failed";
    error = "Treasury token balance did not decrease";
  }

  const [row] = await db
    .insert(buybackExecutions)
    .values({
      proposalId: input.proposalId ?? null,
      kind: input.kind,
      signature: input.signature,
      treasury: owner,
      quoteSpentBaseUnits: input.kind === "buy" && solSpent !== null ? solSpent.toString() : null,
      tokenAmountBaseUnits: (tokenDelta < 0n ? -tokenDelta : tokenDelta).toString(),
      venue: input.kind === "buy" ? "pump" : "spl-burn",
      status,
      error,
      executedBy: input.admin,
      verifiedAt: status === "verified" ? new Date() : null,
    })
    .onConflictDoNothing()
    .returning();
  if (!row) throw new HttpError(409, "This transaction is already logged", "duplicate");

  if (status === "verified" && input.kind === "buy" && input.proposalId) {
    await db.update(buybackProposals).set({ status: "executed" }).where(and(eq(buybackProposals.id, input.proposalId), eq(buybackProposals.status, "approved")));
  }
  return row;
}

export async function buybackOverview(db: Db) {
  const e = env();
  const allTime = await revenueBetween(db, new Date(0), new Date());
  const start = await nextPeriodStart(db);
  const pending = await revenueBetween(db, start, new Date());
  const proposals = await db.select().from(buybackProposals).orderBy(desc(buybackProposals.createdAt)).limit(50);
  const executions = await db.select().from(buybackExecutions).orderBy(desc(buybackExecutions.createdAt)).limit(100);
  const burned = executions.filter((x) => x.kind === "burn" && x.status === "verified").reduce((n, x) => n + BigInt(x.tokenAmountBaseUnits ?? "0"), 0n);
  const bought = executions.filter((x) => x.kind === "buy" && x.status === "verified").reduce((n, x) => n + BigInt(x.tokenAmountBaseUnits ?? "0"), 0n);
  return {
    config: {
      treasury: e.TREASURY_WALLET ?? null,
      mint: e.PROJECT_TOKEN_MINT ?? null,
      network: e.SOLANA_NETWORK,
      allocationBps: e.BUYBACK_ALLOCATION_BPS,
      publicStatus: e.TOKEN_BUYBACK_STATUS,
      decimals: e.PROJECT_TOKEN_DECIMALS,
    },
    revenue: { allTime, sinceLastProposal: { ...pending, periodStart: start, proposedUsd: (pending.net * e.BUYBACK_ALLOCATION_BPS) / 10_000 } },
    totals: { boughtBaseUnits: bought.toString(), burnedBaseUnits: burned.toString() },
    proposals,
    executions,
  };
}
