import type { ParsedInstruction, ParsedTransactionWithMeta, PartiallyDecodedInstruction } from "@solana/web3.js";

/**
 * Pure validation of a fetched, parsed Solana transaction against a payment
 * intent. Credits are only issued when every check passes — a client-side
 * "success" callback is never trusted.
 */

export interface PaymentExpectation {
  /** SOL / SPL: transfer to the treasury. BURN: SPL burn from the payer's own token account. */
  kind: "SOL" | "SPL" | "BURN";
  /** Wallet that must sign and fund the transfer. */
  payer: string;
  /** SOL: treasury wallet. SPL: treasury's token account for the mint. BURN: the payer's token account being burned from. */
  destination: string;
  /** SPL and BURN. */
  mint?: string;
  /** Minimum amount in base units. */
  minAmount: bigint;
  /** Unique reference key that must appear in the transaction's account keys. */
  reference: string;
  notBefore: Date;
  notAfter: Date;
}

export type PaymentCheck =
  | { ok: true; amount: bigint; slot: number; blockTime: number | null }
  | { ok: false; reason: string };

const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const TOKEN_PROGRAMS = new Set(["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"]);

function isParsed(ix: ParsedInstruction | PartiallyDecodedInstruction): ix is ParsedInstruction {
  return "parsed" in ix;
}

export function validatePaymentTransaction(tx: ParsedTransactionWithMeta | null, exp: PaymentExpectation): PaymentCheck {
  if (!tx) return { ok: false, reason: "Transaction not found" };
  if (!tx.meta) return { ok: false, reason: "Transaction metadata unavailable" };
  if (tx.meta.err !== null) return { ok: false, reason: "Transaction failed on-chain" };

  const keys = tx.transaction.message.accountKeys;
  const keyStrings = keys.map((k) => k.pubkey.toBase58());

  const payerKey = keys.find((k) => k.pubkey.toBase58() === exp.payer);
  if (!payerKey?.signer) return { ok: false, reason: "Payer did not sign the transaction" };
  if (!keyStrings.includes(exp.reference)) return { ok: false, reason: "Payment reference missing (transaction is not for this payment)" };

  if (tx.blockTime !== null && tx.blockTime !== undefined) {
    const t = tx.blockTime * 1000;
    if (t < exp.notBefore.getTime()) return { ok: false, reason: "Transaction predates the payment request" };
    if (t > exp.notAfter.getTime()) return { ok: false, reason: "Transaction landed after the quote expired" };
  }

  let total = 0n;
  for (const ix of tx.transaction.message.instructions) {
    if (!isParsed(ix)) continue;
    const program = ix.programId.toBase58();
    const parsed = ix.parsed as { type?: string; info?: Record<string, unknown> };
    const info = parsed?.info ?? {};

    if (exp.kind === "SOL" && program === SYSTEM_PROGRAM && parsed.type === "transfer") {
      if (info.source === exp.payer && info.destination === exp.destination) total += BigInt(String(info.lamports));
    }

    if (exp.kind === "SPL" && TOKEN_PROGRAMS.has(program)) {
      const authority = (info.authority ?? info.multisigAuthority) as string | undefined;
      if (info.destination !== exp.destination || authority !== exp.payer) continue;
      if (parsed.type === "transferChecked") {
        if (info.mint !== exp.mint) continue;
        const amt = (info.tokenAmount as { amount?: string } | undefined)?.amount;
        if (amt) total += BigInt(amt);
      } else if (parsed.type === "transfer") {
        // The destination is the treasury ATA *for this mint*, so the mint is implied.
        total += BigInt(String(info.amount));
      }
    }

    if (exp.kind === "BURN" && TOKEN_PROGRAMS.has(program) && (parsed.type === "burnChecked" || parsed.type === "burn")) {
      const authority = (info.authority ?? info.multisigAuthority) as string | undefined;
      if (info.account !== exp.destination || info.mint !== exp.mint || authority !== exp.payer) continue;
      const amt = parsed.type === "burnChecked" ? (info.tokenAmount as { amount?: string } | undefined)?.amount : String(info.amount);
      if (amt) total += BigInt(amt);
    }
  }

  if (total < exp.minAmount) {
    if (exp.kind === "BURN") return { ok: false, reason: total === 0n ? "No matching token burn" : "Burned amount is lower than quoted" };
    return { ok: false, reason: total === 0n ? "No matching transfer to the treasury" : "Transferred amount is lower than quoted" };
  }

  // Cross-check with balance changes recorded by the runtime.
  const destIndex = keyStrings.indexOf(exp.destination);
  if (destIndex < 0) return { ok: false, reason: "Destination account missing" };
  if (exp.kind === "SOL") {
    const delta = BigInt(tx.meta.postBalances[destIndex]) - BigInt(tx.meta.preBalances[destIndex]);
    if (delta < exp.minAmount) return { ok: false, reason: "Treasury balance did not increase by the quoted amount" };
  } else if (exp.kind === "BURN") {
    const pre = tx.meta.preTokenBalances?.find((b) => b.accountIndex === destIndex && b.mint === exp.mint);
    const post = tx.meta.postTokenBalances?.find((b) => b.accountIndex === destIndex && b.mint === exp.mint);
    const burned = BigInt(pre?.uiTokenAmount.amount ?? "0") - BigInt(post?.uiTokenAmount.amount ?? "0");
    if (burned < exp.minAmount) return { ok: false, reason: "Token balance did not decrease by the quoted amount" };
  } else {
    const pre = tx.meta.preTokenBalances?.find((b) => b.accountIndex === destIndex && b.mint === exp.mint);
    const post = tx.meta.postTokenBalances?.find((b) => b.accountIndex === destIndex && b.mint === exp.mint);
    const delta = BigInt(post?.uiTokenAmount.amount ?? "0") - BigInt(pre?.uiTokenAmount.amount ?? "0");
    if (delta < exp.minAmount) return { ok: false, reason: "Treasury token balance did not increase by the quoted amount" };
  }

  return { ok: true, amount: total, slot: tx.slot, blockTime: tx.blockTime ?? null };
}
