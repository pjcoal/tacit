import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAccount } from "@/server/auth/account";
import { createApiKey } from "@/server/auth/api-keys";
import { getDb } from "@/server/db/client";
import { apiKeys } from "@/server/db/schema";
import { assertSameOrigin, enforceRateLimit, HttpError, parseJson, route } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  const account = await requireAccount(req);
  const rows = await (await getDb())
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      displayPrefix: apiKeys.displayPrefix,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.accountId, account.id))
    .orderBy(desc(apiKeys.createdAt));
  return NextResponse.json({ keys: rows }, { headers: { "cache-control": "no-store" } });
});

/** Create a key. The plaintext key is in this response only; we store a hash. */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const account = await requireAccount(req);
  await enforceRateLimit(`keys:create:${account.id}`, 10, 60 * 60_000);
  const { name } = await parseJson(req, z.object({ name: z.string().trim().min(1).max(48) }), 2048);
  const db = await getDb();
  const existing = await db.select({ id: apiKeys.id }).from(apiKeys).where(eq(apiKeys.accountId, account.id));
  if (existing.length >= 25) throw new HttpError(400, "Key limit reached. Revoke an old key first.", "key_limit");
  const created = await createApiKey(db, account.id, name);
  return NextResponse.json({ key: created }, { status: 201, headers: { "cache-control": "no-store" } });
});
