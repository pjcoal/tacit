"use client";

import { ComputeBudgetProgram, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, type Connection } from "@solana/web3.js";

export const KNOWN_PROGRAMS: Record<string, string> = {
  [SystemProgram.programId.toBase58()]: "System",
  [ComputeBudgetProgram.programId.toBase58()]: "Compute Budget",
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: "SPL Token",
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: "Token-2022",
  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: "Associated Token Account",
  MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr: "Memo",
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P": "Pump",
  pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA: "PumpSwap",
  pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ: "Pump Fees",
  metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s: "Token Metadata",
  MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e: "Pump Mayhem",
};

export const PROGRAMS = {
  payment: ["System", "Compute Budget", "SPL Token", "Token-2022", "Associated Token Account"],
  pumpTrade: ["System", "Compute Budget", "SPL Token", "Token-2022", "Associated Token Account", "Pump", "PumpSwap", "Pump Fees"],
  pumpLaunch: ["System", "Compute Budget", "SPL Token", "Token-2022", "Associated Token Account", "Pump", "Pump Fees", "Token Metadata", "Pump Mayhem"],
  burn: ["Compute Budget", "SPL Token", "Token-2022"],
};

export function decodeTransaction(base64: string): Transaction {
  return Transaction.from(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
}

/**
 * Defence in depth before asking a wallet to sign something the server built:
 * the fee payer must be the connected wallet and every instruction must target
 * an expected program. Wallets show their own simulation as well.
 */
export function assertTransactionShape(tx: Transaction, opts: { feePayer: PublicKey; allowed: string[] }) {
  if (!tx.feePayer?.equals(opts.feePayer)) throw new Error("Transaction fee payer is not your connected wallet.");
  for (const ix of tx.instructions) {
    const name = KNOWN_PROGRAMS[ix.programId.toBase58()];
    if (!name || !opts.allowed.includes(name)) {
      throw new Error(`Unexpected program in transaction: ${ix.programId.toBase58()}`);
    }
  }
  return tx.instructions.map((ix) => KNOWN_PROGRAMS[ix.programId.toBase58()]);
}

/** Poll for a signature to reach a commitment (no websocket required). */
export async function confirmSignature(
  connection: Connection,
  signature: string,
  commitment: "confirmed" | "finalized" = "confirmed",
  timeoutMs = 90_000,
): Promise<void> {
  const start = Date.now();
  for (;;) {
    const { value } = await connection.getSignatureStatuses([signature], { searchTransactionHistory: false });
    const s = value[0];
    if (s?.err) throw new Error("Transaction failed on-chain.");
    if (s && (s.confirmationStatus === commitment || s.confirmationStatus === "finalized")) return;
    if (Date.now() - start > timeoutMs) throw new Error("Timed out waiting for confirmation. Check the explorer before retrying.");
    await new Promise((r) => setTimeout(r, 1500));
  }
}

export const lamportsToSol = (l: number | bigint) => Number(l) / LAMPORTS_PER_SOL;
export const solToLamports = (sol: number) => BigInt(Math.round(sol * LAMPORTS_PER_SOL));

export function rpcEndpoint(publicRpcUrl: string | null): string {
  if (publicRpcUrl) return publicRpcUrl;
  if (typeof window === "undefined") return "http://localhost:3000/api/solana/rpc";
  return `${window.location.origin}/api/solana/rpc`;
}
