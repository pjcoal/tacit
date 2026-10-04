import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryDb, type Db } from "@/server/db/client";
import { accounts, creditLedger, paymentIntents, subscriptions } from "@/server/db/schema";
import { getBalance } from "@/server/services/ledger";
import { fulfillPayment, ReplayError, verifyAndFulfill, type TxFetcher } from "@/server/services/payments";
import { key, parsedTx } from "./helpers";

const SIG_A = "5".repeat(87) + "a";
const SIG_B = "4".repeat(87) + "b";

let db: Db;
let accountId: string;
const payer = key();
const treasury = key();

async function intent(over: Partial<typeof paymentIntents.$inferInsert> = {}) {
  const [row] = await db
    .insert(paymentIntents)
    .values({
      accountId,
      kind: "credits",
      productId: "credits_10",
      currency: "SOL",
      payer,
      treasury,
      destination: treasury,
      amountBaseUnits: "1000000",
      usdAmount: "10",
      unitPriceUsd: "150",
      credits: 1000,
      reference: key(),
      expiresAt: new Date(Date.now() + 180_000),
      ...over,
    })
    .returning();
  return row;
}

function fetcherFor(reference: string, lamports = 1_000_000): TxFetcher {
  return async () =>
    parsedTx({
      payer,
      keys: [{ pubkey: payer, signer: true }, { pubkey: treasury }, { pubkey: reference }],
      instructions: [{ program: "system", type: "transfer", info: { source: payer, destination: treasury, lamports } }],
      preBalances: [10_000_000_000, 0, 0],
      postBalances: [10_000_000_000 - lamports, lamports, 0],
    });
}

beforeEach(async () => {
  db = await createMemoryDb();
  [{ id: accountId }] = await db.insert(accounts).values({ secretHash: key() }).returning({ id: accounts.id });
});

describe("payment fulfilment", () => {
  it("issues credits once for a verified transaction", async () => {
    const i = await intent();
    const r = await verifyAndFulfill(db, accountId, i.id, SIG_A, fetcherFor(i.reference), "confirmed");
    expect(r).toEqual({ status: "completed", credits: 1000 });
    expect(await getBalance(db, accountId)).toBe(1000);
  });

  it("is idempotent when the same signature is submitted again (no double credit)", async () => {
    const i = await intent();
    await verifyAndFulfill(db, accountId, i.id, SIG_A, fetcherFor(i.reference), "confirmed");
    const again = await verifyAndFulfill(db, accountId, i.id, SIG_A, fetcherFor(i.reference), "confirmed");
    expect(again.status).toBe("already_completed");
    expect(await getBalance(db, accountId)).toBe(1000);
  });

  it("rejects replaying one signature against a second intent", async () => {
    const first = await intent();
    const second = await intent();
    await verifyAndFulfill(db, accountId, first.id, SIG_A, fetcherFor(first.reference), "confirmed");
    await expect(verifyAndFulfill(db, accountId, second.id, SIG_A, fetcherFor(second.reference), "confirmed")).rejects.toBeInstanceOf(ReplayError);
    expect(await getBalance(db, accountId)).toBe(1000);
  });

  it("rejects the replay at the database level even if the pre-check is bypassed (race)", async () => {
    const first = await intent();
    const second = await intent();
    await fulfillPayment(db, first.id, { signature: SIG_A, amount: 1_000_000n, slot: 1, commitment: "confirmed" });
    await expect(fulfillPayment(db, second.id, { signature: SIG_A, amount: 1_000_000n, slot: 1, commitment: "confirmed" })).rejects.toBeInstanceOf(ReplayError);
    const [s] = await db.select().from(paymentIntents).where(eq(paymentIntents.id, second.id));
    expect(s.status).toBe("pending"); // rolled back
    expect(await getBalance(db, accountId)).toBe(1000);
  });

  it("concurrent fulfilment of one intent credits exactly once", async () => {
    const i = await intent();
    const results = await Promise.allSettled([
      fulfillPayment(db, i.id, { signature: SIG_A, amount: 1_000_000n, slot: 1, commitment: "confirmed" }),
      fulfillPayment(db, i.id, { signature: SIG_B, amount: 1_000_000n, slot: 1, commitment: "confirmed" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rows = await db.select().from(creditLedger).where(eq(creditLedger.accountId, accountId));
    expect(rows).toHaveLength(1);
  });

  it("refuses a transaction that doesn't reference this intent", async () => {
    const i = await intent();
    await expect(verifyAndFulfill(db, accountId, i.id, SIG_A, fetcherFor(key()), "confirmed")).rejects.toMatchObject({ code: "verification_failed" });
    expect(await getBalance(db, accountId)).toBe(0);
  });

  it("refuses underpayment", async () => {
    const i = await intent();
    await expect(verifyAndFulfill(db, accountId, i.id, SIG_A, fetcherFor(i.reference, 999_000), "confirmed")).rejects.toMatchObject({ code: "verification_failed" });
  });

  it("does not let another account redeem an intent", async () => {
    const i = await intent();
    const [{ id: other }] = await db.insert(accounts).values({ secretHash: key() }).returning({ id: accounts.id });
    await expect(verifyAndFulfill(db, other, i.id, SIG_A, fetcherFor(i.reference), "confirmed")).rejects.toMatchObject({ status: 404 });
  });

  it("reports pending while the transaction isn't visible at the required commitment", async () => {
    const i = await intent();
    expect(await verifyAndFulfill(db, accountId, i.id, SIG_A, async () => null, "finalized")).toEqual({ status: "pending" });
  });

  it("grants a fixed-duration subscription for plan purchases", async () => {
    const i = await intent({ kind: "plan", productId: "pro", credits: 1500 });
    await verifyAndFulfill(db, accountId, i.id, SIG_A, fetcherFor(i.reference), "confirmed");
    const subs = await db.select().from(subscriptions).where(eq(subscriptions.accountId, accountId));
    expect(subs).toHaveLength(1);
    expect(subs[0].endsAt.getTime() - subs[0].startsAt.getTime()).toBe(30 * 86_400_000);
    expect(await getBalance(db, accountId)).toBe(1500);
  });
});
