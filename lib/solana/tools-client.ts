"use client";

import { getAssociatedTokenAddressSync, getMint, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { LAMPORTS_PER_SOL, PublicKey, type Connection, type ParsedTransactionWithMeta } from "@solana/web3.js";
import { solanaToolSchemas, WRITE_TOOLS, type SolanaToolName } from "@/lib/ai/tools";
import type { TransferPreview } from "@/lib/storage/db";
import { isBase58PublicKey, isBase58Signature64 } from "./address";
import { KNOWN_PROGRAMS } from "./client";
import { readMintInfo } from "./token-metadata";
import { MAX_TX_VERSION } from "@/lib/solana/constants";

export interface ToolContext {
  connection: Connection;
  wallet: PublicKey | null;
  knownMints: Record<string, string>;
}

export type ToolOutcome =
  | { kind: "result"; data: unknown; summary: string }
  | { kind: "preview"; preview: TransferPreview; summary: string }
  | { kind: "error"; error: string };

const NO_WALLET = "No wallet is connected. Ask the user to connect a Solana wallet from the sidebar, then try again.";

async function tokenHoldings(ctx: ToolContext, owner: PublicKey) {
  const [a, b] = await Promise.all([
    ctx.connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }, "confirmed"),
    ctx.connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID }, "confirmed"),
  ]);
  return [...a.value, ...b.value]
    .map((acc) => {
      const info = acc.account.data.parsed.info as { mint: string; tokenAmount: { uiAmount: number | null; amount: string; decimals: number } };
      return { mint: info.mint, symbol: ctx.knownMints[info.mint] ?? null, amount: info.tokenAmount.uiAmount ?? 0, decimals: info.tokenAmount.decimals };
    })
    .filter((t) => t.amount > 0)
    .sort((x, y) => y.amount - x.amount);
}

function summarizeTx(tx: ParsedTransactionWithMeta, wallet: PublicKey | null) {
  const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey.toBase58());
  const w = wallet?.toBase58();
  const idx = w ? keys.indexOf(w) : -1;
  const solChange = idx >= 0 && tx.meta ? (tx.meta.postBalances[idx] - tx.meta.preBalances[idx]) / LAMPORTS_PER_SOL : null;
  const tokenChanges = (tx.meta?.postTokenBalances ?? [])
    .filter((p) => p.owner === w)
    .map((p) => {
      const pre = tx.meta?.preTokenBalances?.find((q) => q.accountIndex === p.accountIndex);
      return { mint: p.mint, change: (p.uiTokenAmount.uiAmount ?? 0) - (pre?.uiTokenAmount.uiAmount ?? 0) };
    })
    .filter((c) => c.change !== 0);
  const programs = [...new Set(tx.transaction.message.instructions.map((ix) => KNOWN_PROGRAMS[ix.programId.toBase58()] ?? ix.programId.toBase58()))];
  const actions = tx.transaction.message.instructions
    .map((ix) => ("parsed" in ix ? `${ix.program}:${(ix.parsed as { type?: string })?.type ?? "?"}` : null))
    .filter(Boolean);
  return {
    signature: tx.transaction.signatures[0],
    time: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null,
    status: tx.meta?.err ? "failed" : "success",
    feeSol: (tx.meta?.fee ?? 0) / LAMPORTS_PER_SOL,
    walletSolChange: solChange,
    walletTokenChanges: tokenChanges,
    programs,
    actions,
  };
}

/**
 * Execute a Solana tool in the browser. Arguments have already had
 * placeholders restored. Write tools never sign — they return a preview.
 */
export async function runSolanaTool(name: string, rawInput: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  if (!(name in solanaToolSchemas)) return { kind: "error", error: `Unknown tool ${name}` };
  const parsed = solanaToolSchemas[name as SolanaToolName].safeParse(rawInput ?? {});
  if (!parsed.success) return { kind: "error", error: `Invalid arguments: ${parsed.error.issues.map((i) => i.message).join("; ")}` };
  const input = parsed.data as Record<string, unknown>;
  const { connection } = ctx;

  try {
    switch (name as SolanaToolName) {
      case "solana_wallet_overview": {
        if (!ctx.wallet) return { kind: "error", error: NO_WALLET };
        const [lamports, tokens] = await Promise.all([connection.getBalance(ctx.wallet, "confirmed"), tokenHoldings(ctx, ctx.wallet)]);
        return {
          kind: "result",
          summary: `Read SOL balance and ${tokens.length} token holdings`,
          data: { wallet: ctx.wallet.toBase58(), sol: lamports / LAMPORTS_PER_SOL, tokenCount: tokens.length, largestTokens: tokens.slice(0, 10) },
        };
      }
      case "solana_token_balances": {
        if (!ctx.wallet) return { kind: "error", error: NO_WALLET };
        const tokens = await tokenHoldings(ctx, ctx.wallet);
        return { kind: "result", summary: `Read ${tokens.length} token balances`, data: { tokens: tokens.slice(0, input.limit as number) } };
      }
      case "solana_recent_transactions": {
        if (!ctx.wallet) return { kind: "error", error: NO_WALLET };
        const sigs = await connection.getSignaturesForAddress(ctx.wallet, { limit: input.limit as number }, "confirmed");
        const txs = await Promise.all(
          sigs.map((s) => connection.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: MAX_TX_VERSION, commitment: "confirmed" }).catch(() => null)),
        );
        const rows = sigs.map((s, i) => {
          const t = txs[i];
          return t ? summarizeTx(t, ctx.wallet) : { signature: s.signature, time: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : null, status: s.err ? "failed" : "success" };
        });
        return { kind: "result", summary: `Read ${rows.length} recent transactions`, data: { transactions: rows } };
      }
      case "solana_explain_transaction": {
        let sig = String(input.signature);
        if (sig === "latest") {
          if (!ctx.wallet) return { kind: "error", error: NO_WALLET };
          const [s] = await connection.getSignaturesForAddress(ctx.wallet, { limit: 1 }, "confirmed");
          if (!s) return { kind: "result", summary: "No transactions found", data: { found: false } };
          sig = s.signature;
        }
        if (!isBase58Signature64(sig)) return { kind: "error", error: "That is not a valid transaction signature." };
        const tx = await connection.getParsedTransaction(sig, { maxSupportedTransactionVersion: MAX_TX_VERSION, commitment: "confirmed" });
        if (!tx) return { kind: "result", summary: "Transaction not found", data: { found: false } };
        return { kind: "result", summary: "Read transaction details", data: summarizeTx(tx, ctx.wallet) };
      }
      case "solana_token_info": {
        const mint = String(input.mint);
        if (!isBase58PublicKey(mint)) return { kind: "error", error: "That is not a valid mint address." };
        const info = await readMintInfo(connection, new PublicKey(mint));
        return { kind: "result", summary: `Read token info for ${info.symbol ?? "mint"}`, data: { ...info, supply: info.supply.toString() } };
      }
      case "solana_prepare_sol_transfer": {
        if (!ctx.wallet) return { kind: "error", error: NO_WALLET };
        const to = String(input.to);
        if (!isBase58PublicKey(to)) return { kind: "error", error: "The recipient is not a valid Solana address." };
        if (to === ctx.wallet.toBase58()) return { kind: "error", error: "The recipient is the user's own wallet." };
        const amountSol = input.amountSol as number;
        const lamports = BigInt(Math.round(amountSol * LAMPORTS_PER_SOL));
        const balance = BigInt(await connection.getBalance(ctx.wallet, "confirmed"));
        if (lamports + 10_000n > balance) return { kind: "error", error: "The wallet doesn't have enough SOL for this transfer plus fees." };
        return {
          kind: "preview",
          summary: `Prepared ${amountSol} SOL transfer for the user to review`,
          preview: { kind: "sol", to, amountUi: amountSol, amountBase: lamports.toString(), feeLamports: 5000 },
        };
      }
      case "solana_prepare_token_transfer": {
        if (!ctx.wallet) return { kind: "error", error: NO_WALLET };
        const to = String(input.to);
        const mintStr = String(input.mint);
        if (!isBase58PublicKey(to)) return { kind: "error", error: "The recipient is not a valid Solana address." };
        if (!isBase58PublicKey(mintStr)) return { kind: "error", error: "The mint is not a valid address." };
        const mint = new PublicKey(mintStr);
        const acct = await connection.getAccountInfo(mint);
        if (!acct || !(acct.owner.equals(TOKEN_PROGRAM_ID) || acct.owner.equals(TOKEN_2022_PROGRAM_ID))) return { kind: "error", error: "Mint not found." };
        const mi = await getMint(connection, mint, "confirmed", acct.owner);
        const amount = input.amount as number;
        const base = BigInt(Math.round(amount * 10 ** mi.decimals));
        const holdings = await tokenHoldings(ctx, ctx.wallet);
        const held = holdings.find((h) => h.mint === mintStr)?.amount ?? 0;
        if (held < amount) return { kind: "error", error: `The wallet holds ${held} of this token, less than ${amount}.` };
        const destAta = getAssociatedTokenAddressSync(mint, new PublicKey(to), true, acct.owner);
        const destExists = Boolean(await connection.getAccountInfo(destAta));
        return {
          kind: "preview",
          summary: `Prepared ${amount} token transfer for the user to review`,
          preview: {
            kind: "token",
            to,
            amountUi: amount,
            amountBase: base.toString(),
            mint: mintStr,
            decimals: mi.decimals,
            symbol: ctx.knownMints[mintStr],
            tokenProgram: acct.owner.toBase58(),
            feeLamports: 5000,
            createsRecipientAccount: !destExists,
          },
        };
      }
    }
  } catch (e) {
    return { kind: "error", error: (e as Error).message || "RPC request failed" };
  }
}

export const isWriteTool = (name: string) => WRITE_TOOLS.has(name as SolanaToolName);
