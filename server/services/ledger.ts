import "server-only";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { creditLedger, subscriptions, usageRecords } from "@/server/db/schema";

export async function getBalance(db: Db, accountId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${creditLedger.delta}), 0)` })
    .from(creditLedger)
    .where(eq(creditLedger.accountId, accountId));
  return Number(row?.total ?? 0);
}

export async function activeSubscription(db: Db, accountId: string) {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.accountId, accountId), gt(subscriptions.endsAt, new Date())))
    .orderBy(desc(subscriptions.endsAt))
    .limit(1);
  return row ?? null;
}

export interface UsageInput {
  accountId: string | null;
  apiKeyId?: string | null;
  source: "app" | "api";
  kind: "chat" | "image" | "video" | "code";
  model: string;
  provider: string;
  inputTokens?: number;
  outputTokens?: number;
  units?: number;
  credits: number;
  providerCostUsd: number;
}

/**
 * Record metered usage (no content, only counts) and debit credits in one
 * transaction. The ledger's unique (ref_type, ref_id) index makes the debit
 * impossible to apply twice.
 */
export async function recordUsage(db: Db, u: UsageInput): Promise<string> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(usageRecords)
      .values({
        accountId: u.accountId,
        apiKeyId: u.apiKeyId ?? null,
        source: u.source,
        kind: u.kind,
        model: u.model,
        provider: u.provider,
        inputTokens: u.inputTokens ?? 0,
        outputTokens: u.outputTokens ?? 0,
        units: u.units ?? 0,
        credits: u.credits,
        providerCostUsd: u.providerCostUsd.toFixed(6),
      })
      .returning({ id: usageRecords.id });
    if (u.accountId && u.credits > 0) {
      await tx.insert(creditLedger).values({
        accountId: u.accountId,
        delta: -u.credits,
        reason: "usage",
        refType: "usage",
        refId: row.id,
      });
    }
    return row.id;
  });
}

/** Idempotent refund keyed by (refType, refId). Returns false if it was already refunded. */
export async function refundCredits(db: Db, accountId: string, credits: number, refType: string, refId: string): Promise<boolean> {
  const rows = await db
    .insert(creditLedger)
    .values({ accountId, delta: credits, reason: "refund", refType, refId })
    .onConflictDoNothing()
    .returning({ id: creditLedger.id });
  return rows.length > 0;
}
