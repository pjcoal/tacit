import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { apiKeys } from "@/server/db/schema";
import { HttpError } from "@/server/http";
import { API_KEY_PREFIX, isApiKey, randomToken, sha256Hex } from "./secrets";

export function generateApiKey(): { key: string; hash: string; displayPrefix: string } {
  const key = randomToken(API_KEY_PREFIX);
  return { key, hash: sha256Hex(key), displayPrefix: `${key.slice(0, API_KEY_PREFIX.length + 6)}…` };
}

/** Create a key. The plaintext is returned exactly once and never stored. */
export async function createApiKey(db: Db, accountId: string, name: string) {
  const { key, hash, displayPrefix } = generateApiKey();
  const [row] = await db
    .insert(apiKeys)
    .values({ accountId, name, keyHash: hash, displayPrefix })
    .returning({ id: apiKeys.id, name: apiKeys.name, displayPrefix: apiKeys.displayPrefix, createdAt: apiKeys.createdAt });
  return { ...row, key };
}

export async function revokeApiKey(db: Db, accountId: string, keyId: string): Promise<boolean> {
  const rows = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.accountId, accountId), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id });
  return rows.length > 0;
}

export function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(h.trim());
  return m ? m[1] : null;
}

/** Resolve an API key to its account. Throws 401 for missing, malformed, unknown or revoked keys. */
export async function authenticateApiKey(db: Db, token: string | null) {
  if (!token) throw new HttpError(401, "Missing API key. Send `Authorization: Bearer <key>`.", "missing_api_key");
  if (!isApiKey(token)) throw new HttpError(401, "Malformed API key.", "invalid_api_key");
  const [row] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, sha256Hex(token))).limit(1);
  if (!row) throw new HttpError(401, "Invalid API key.", "invalid_api_key");
  if (row.revokedAt) throw new HttpError(401, "This API key has been revoked.", "revoked_api_key");
  // Coarse last-used timestamp (at most once a minute) to limit write load.
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));
  }
  return { keyId: row.id, accountId: row.accountId };
}
