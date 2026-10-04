import { NextResponse } from "next/server";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { requireAccount } from "@/server/auth/account";
import { getDb } from "@/server/db/client";
import { apiKeys, creditLedger, usageRecords } from "@/server/db/schema";
import { route } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Metered usage for the developer dashboard: counts and credits only, never content. */
export const GET = route(async (req: Request) => {
  const account = await requireAccount(req);
  const db = await getDb();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totals] = await db
    .select({
      requests: sql<string>`count(*)`,
      inputTokens: sql<string>`coalesce(sum(${usageRecords.inputTokens}), 0)`,
      outputTokens: sql<string>`coalesce(sum(${usageRecords.outputTokens}), 0)`,
      credits: sql<string>`coalesce(sum(${usageRecords.credits}), 0)`,
    })
    .from(usageRecords)
    .where(and(eq(usageRecords.accountId, account.id), gte(usageRecords.createdAt, since)));

  const byKey = await db
    .select({
      apiKeyId: usageRecords.apiKeyId,
      name: apiKeys.name,
      requests: sql<string>`count(*)`,
      credits: sql<string>`coalesce(sum(${usageRecords.credits}), 0)`,
    })
    .from(usageRecords)
    .leftJoin(apiKeys, eq(apiKeys.id, usageRecords.apiKeyId))
    .where(and(eq(usageRecords.accountId, account.id), gte(usageRecords.createdAt, since), eq(usageRecords.source, "api")))
    .groupBy(usageRecords.apiKeyId, apiKeys.name);

  const recent = await db
    .select({
      createdAt: usageRecords.createdAt,
      source: usageRecords.source,
      kind: usageRecords.kind,
      model: usageRecords.model,
      inputTokens: usageRecords.inputTokens,
      outputTokens: usageRecords.outputTokens,
      units: usageRecords.units,
      credits: usageRecords.credits,
    })
    .from(usageRecords)
    .where(eq(usageRecords.accountId, account.id))
    .orderBy(desc(usageRecords.createdAt))
    .limit(50);

  const ledger = await db
    .select({ createdAt: creditLedger.createdAt, delta: creditLedger.delta, reason: creditLedger.reason })
    .from(creditLedger)
    .where(and(eq(creditLedger.accountId, account.id)))
    .orderBy(desc(creditLedger.createdAt))
    .limit(50);

  return NextResponse.json(
    {
      last30Days: {
        requests: Number(totals.requests),
        inputTokens: Number(totals.inputTokens),
        outputTokens: Number(totals.outputTokens),
        credits: Number(totals.credits),
      },
      byKey: byKey.map((k) => ({ apiKeyId: k.apiKeyId, name: k.name ?? "Deleted key", requests: Number(k.requests), credits: Number(k.credits) })),
      recent,
      ledger: ledger.filter((l) => l.reason !== "usage"),
    },
    { headers: { "cache-control": "no-store" } },
  );
});
