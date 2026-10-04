import "server-only";
import { getBuyTokenAmountFromSolAmount, normalizeQuoteMint, OnlinePumpSdk, PUMP_SDK } from "@pump-fun/pump-sdk";
import { ComputeBudgetProgram, PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";
import { getVerifiedConnection } from "@/lib/solana/connection";

export interface LaunchParams {
  name: string;
  symbol: string;
  uri: string;
  /** Public key of a fresh mint keypair generated in the admin's browser (it co-signs client-side). */
  mint: string;
  /** Admin wallet: pays, creates and receives the optional initial buy. */
  creator: string;
  initialBuyLamports: bigint;
}

/**
 * Build the unsigned create (+ optional first buy) transaction with the
 * official Pump SDK. It needs two signatures, both client-side: the new mint
 * keypair and the admin wallet. The server never sees either secret.
 */
export async function buildLaunchTransaction(p: LaunchParams) {
  const conn = await getVerifiedConnection();
  const sdk = new OnlinePumpSdk(conn);
  const mint = new PublicKey(p.mint);
  const creator = new PublicKey(p.creator);

  if (await conn.getAccountInfo(mint)) throw new Error("That mint address already exists; generate a new one.");

  const global = await sdk.fetchGlobal().catch(() => {
    throw new Error("Pump global state not found on this cluster. Pump may not be deployed here.");
  });

  let instructions: TransactionInstruction[];
  if (p.initialBuyLamports > 0n) {
    const solAmount = new BN(p.initialBuyLamports.toString());
    const feeConfig = await sdk.fetchFeeConfig().catch(() => null);
    const amount = getBuyTokenAmountFromSolAmount({
      global,
      feeConfig,
      mintSupply: null,
      bondingCurve: null,
      amount: solAmount,
      quoteMint: normalizeQuoteMint(null),
    });
    instructions = global.createV2Enabled
      ? await PUMP_SDK.createV2AndBuyInstructions({ global, mint, name: p.name, symbol: p.symbol, uri: p.uri, creator, user: creator, amount, solAmount, mayhemMode: false })
      : await PUMP_SDK.createAndBuyInstructions({ global, mint, name: p.name, symbol: p.symbol, uri: p.uri, creator, user: creator, amount, solAmount });
  } else {
    instructions = [
      global.createV2Enabled
        ? await PUMP_SDK.createV2Instruction({ mint, name: p.name, symbol: p.symbol, uri: p.uri, creator, user: creator, mayhemMode: false })
        : await PUMP_SDK.createInstruction({ mint, name: p.name, symbol: p.symbol, uri: p.uri, creator, user: creator }),
    ];
  }

  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: creator, blockhash, lastValidBlockHeight });
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }), ...instructions);
  return {
    transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"),
    standard: global.createV2Enabled ? "Token-2022 (create_v2)" : "SPL Token (create)",
  };
}
