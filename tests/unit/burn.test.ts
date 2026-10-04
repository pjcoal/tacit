import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { Keypair } from "@solana/web3.js";
import { beforeEach, describe, expect, it } from "vitest";
import { buildBurnPaymentTransaction } from "@/lib/payments/transaction";
import { createMemoryDb, type Db } from "@/server/db/client";
import { accounts, paymentIntents } from "@/server/db/schema";
import { revenueBetween } from "@/server/services/buyback";
import { getBalance } from "@/server/services/ledger";
import { fulfillPayment } from "@/server/services/payments";
import { key } from "./helpers";

describe("burn payment transaction", () => {
  it("burns from the payer's own token account and carries the reference", () => {
    const payer = Keypair.generate().publicKey;
    const mint = Keypair.generate().publicKey;
    const reference = Keypair.generate().publicKey;
    const tx = buildBurnPaymentTransaction({
      payer,
      treasury: Keypair.generate().publicKey,
      reference,
      amount: 8_000_000n,
      recentBlockhash: "11111111111111111111111111111111",
      lastValidBlockHeight: 1,
      spl: { mint, decimals: 6, programId: TOKEN_2022_PROGRAM_ID },
    });
    const burn = tx.instructions[1];
    expect(burn.programId.equals(TOKEN_2022_PROGRAM_ID)).toBe(true);
    expect(burn.data[0]).toBe(15); // BurnChecked
    expect(burn.keys[0].pubkey.equals(getAssociatedTokenAddressSync(mint, payer, false, TOKEN_2022_PROGRAM_ID))).toBe(true);
    expect(burn.keys[2].pubkey.equals(payer) && burn.keys[2].isSigner).toBe(true);
    expect(burn.keys.some((k) => k.pubkey.equals(reference) && !k.isSigner && !k.isWritable)).toBe(true);
    expect(tx.feePayer?.equals(payer)).toBe(true);
  });
});

describe("burn fulfilment", () => {
  let db: Db;
  let accountId: string;
  beforeEach(async () => {
    db = await createMemoryDb();
    [{ id: accountId }] = await db.insert(accounts).values({ secretHash: key() }).returning({ id: accounts.id });
  });

  it("grants credits but is not counted as revenue", async () => {
    const base = { accountId, kind: "credits" as const, productId: "credits_10", payer: key(), treasury: key(), destination: key(), unitPriceUsd: "0.001", credits: 1000, expiresAt: new Date(Date.now() + 60_000) };
    const [burn] = await db.insert(paymentIntents).values({ ...base, currency: "BURN", mint: key(), amountBaseUnits: "8000000000", usdAmount: "8", reference: key() }).returning();
    const [usdc] = await db.insert(paymentIntents).values({ ...base, currency: "USDC", mint: key(), amountBaseUnits: "10000000", usdAmount: "10", reference: key() }).returning();
    await fulfillPayment(db, burn.id, { signature: "b".repeat(88), amount: 8_000_000_000n, slot: 1, commitment: "confirmed" });
    await fulfillPayment(db, usdc.id, { signature: "u".repeat(88), amount: 10_000_000n, slot: 1, commitment: "confirmed" });
    expect(await getBalance(db, accountId)).toBe(2000);
    const rev = await revenueBetween(db, new Date(0), new Date(Date.now() + 1000));
    expect(rev.gross).toBe(10);
  });
});
