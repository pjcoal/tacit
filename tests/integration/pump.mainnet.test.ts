/**
 * Read-only check of the Pump / PumpSwap integration against mainnet:
 * finds a recently created pump.fun coin, reads its curve, quotes a buy and
 * builds (but never signs or sends) the buy transaction.
 *
 *   RUN_INTEGRATION=1 SOLANA_NETWORK=mainnet-beta SOLANA_RPC_URL=<rpc> npx vitest run
 */
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { getBondingCurveState, getGraduationStatus, getTokenQuote, prepareBuyTransaction } from "@/lib/solana/pump";
import { MAX_TX_VERSION } from "@/lib/solana/constants";

const PUMP = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");

async function findRecentPumpMint(conn: Connection): Promise<string> {
  const sigs = await conn.getSignaturesForAddress(PUMP, { limit: 40 });
  for (const s of sigs) {
    if (s.err) continue;
    const tx = await conn.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: MAX_TX_VERSION });
    const mint = tx?.meta?.postTokenBalances?.map((b) => b.mint).find((m) => m.endsWith("pump"));
    if (mint) return mint;
  }
  throw new Error("no recent pump mint found");
}

describe("pump.fun integration (mainnet, read-only)", () => {
  it("reads a curve, quotes, and builds an unsigned buy", async () => {
    const conn = new Connection(process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com", "confirmed");
    const mint = await findRecentPumpMint(conn);
    const status = await getGraduationStatus(mint);
    console.log("mint", mint, status);
    expect(["bonding_curve", "graduated"]).toContain(status.status);

    if (status.status === "bonding_curve") {
      const curve = await getBondingCurveState(mint);
      expect(curve?.priceQuotePerToken).toBeGreaterThan(0);
      console.log("price (lamports/token)", curve?.priceQuotePerToken, "progress", curve?.progressPct.toFixed(2));
    }

    const quote = await getTokenQuote({ mint, side: "buy", amountIn: 10_000_000n, slippagePct: 5 });
    console.log("quote", quote);
    expect(BigInt(quote.expectedOut)).toBeGreaterThan(0n);
    expect(BigInt(quote.minOut)).toBeLessThan(BigInt(quote.expectedOut));

    const user = Keypair.generate().publicKey.toBase58();
    const built = await prepareBuyTransaction({ mint, user, lamports: 10_000_000n, slippagePct: 5 });
    const tx = Transaction.from(Buffer.from(built.transaction, "base64"));
    expect(tx.feePayer?.toBase58()).toBe(user);
    expect(tx.signatures.every((s) => s.signature === null)).toBe(true); // unsigned
    console.log("programs", [...new Set(tx.instructions.map((i) => i.programId.toBase58()))]);
  }, 120_000);
});
