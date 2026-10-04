import { beforeEach, describe, expect, it } from "vitest";
import { authenticateApiKey, bearerToken, createApiKey, generateApiKey, revokeApiKey } from "@/server/auth/api-keys";
import { sha256Hex } from "@/server/auth/secrets";
import { createMemoryDb, type Db } from "@/server/db/client";
import { accounts, apiKeys } from "@/server/db/schema";

let db: Db;
let accountId: string;

beforeEach(async () => {
  db = await createMemoryDb();
  [{ id: accountId }] = await db.insert(accounts).values({ secretHash: "x" }).returning({ id: accounts.id });
});

describe("API keys", () => {
  it("generates high-entropy keys and stores only a hash", async () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.key).not.toBe(b.key);
    expect(a.key).toMatch(/^veil_sk_[A-Za-z0-9_-]{43}$/);
    const created = await createApiKey(db, accountId, "ci");
    const rows = await db.select().from(apiKeys);
    expect(rows[0].keyHash).toBe(sha256Hex(created.key));
    expect(JSON.stringify(rows)).not.toContain(created.key);
  });

  it("authenticates a valid key", async () => {
    const created = await createApiKey(db, accountId, "ci");
    const auth = await authenticateApiKey(db, created.key);
    expect(auth.accountId).toBe(accountId);
  });

  it("rejects missing, malformed, unknown and revoked keys", async () => {
    await expect(authenticateApiKey(db, null)).rejects.toMatchObject({ status: 401, code: "missing_api_key" });
    await expect(authenticateApiKey(db, "sk-not-ours")).rejects.toMatchObject({ code: "invalid_api_key" });
    await expect(authenticateApiKey(db, generateApiKey().key)).rejects.toMatchObject({ code: "invalid_api_key" });
    const created = await createApiKey(db, accountId, "ci");
    expect(await revokeApiKey(db, accountId, created.id)).toBe(true);
    await expect(authenticateApiKey(db, created.key)).rejects.toMatchObject({ code: "revoked_api_key" });
  });

  it("only the owner can revoke a key", async () => {
    const created = await createApiKey(db, accountId, "ci");
    const [{ id: other }] = await db.insert(accounts).values({ secretHash: "y" }).returning({ id: accounts.id });
    expect(await revokeApiKey(db, other, created.id)).toBe(false);
  });

  it("parses bearer tokens", () => {
    expect(bearerToken(new Request("http://x", { headers: { authorization: "Bearer abc" } }))).toBe("abc");
    expect(bearerToken(new Request("http://x", { headers: { authorization: "Basic abc" } }))).toBeNull();
    expect(bearerToken(new Request("http://x"))).toBeNull();
  });
});
