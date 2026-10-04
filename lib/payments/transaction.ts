import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { ComputeBudgetProgram, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

export interface PaymentTxParams {
  payer: PublicKey;
  treasury: PublicKey;
  reference: PublicKey;
  amount: bigint;
  recentBlockhash: string;
  lastValidBlockHeight: number;
  spl?: { mint: PublicKey; decimals: number; programId: PublicKey };
}

/** The treasury's receiving account: the wallet for SOL, its ATA for SPL tokens. */
export function paymentDestination(treasury: PublicKey, spl?: { mint: PublicKey; programId: PublicKey }): PublicKey {
  return spl ? getAssociatedTokenAddressSync(spl.mint, treasury, true, spl.programId) : treasury;
}

/**
 * A single transfer to the treasury, tagged with a unique read-only reference
 * key so the server can bind the on-chain transaction to one payment intent.
 * Returned unsigned; the payer's wallet signs.
 */
export function buildPaymentTransaction(p: PaymentTxParams): Transaction {
  const tx = new Transaction({ feePayer: p.payer, blockhash: p.recentBlockhash, lastValidBlockHeight: p.lastValidBlockHeight });
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 60_000 }));
  const referenceMeta = { pubkey: p.reference, isSigner: false, isWritable: false };

  if (!p.spl) {
    const ix = SystemProgram.transfer({ fromPubkey: p.payer, toPubkey: p.treasury, lamports: p.amount });
    ix.keys.push(referenceMeta);
    tx.add(ix);
    return tx;
  }

  const { mint, decimals, programId } = p.spl;
  const source = getAssociatedTokenAddressSync(mint, p.payer, false, programId);
  const destination = paymentDestination(p.treasury, p.spl);
  // No-op when the treasury account already exists.
  tx.add(createAssociatedTokenAccountIdempotentInstruction(p.payer, destination, p.treasury, mint, programId));
  const ix = createTransferCheckedInstruction(source, mint, destination, p.payer, p.amount, decimals, [], programId);
  ix.keys.push(referenceMeta);
  tx.add(ix);
  return tx;
}
