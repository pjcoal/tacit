import { z } from "zod";
import type { ToolDefinition } from "./types";

/**
 * Solana connector tools. The server only *advertises* these to the model;
 * they execute in the browser against the user's connected wallet, so the
 * model never sees keys and the server never sees balances. Write tools only
 * *prepare* a transaction: the user reviews it and their wallet signs it.
 */

export const SOLANA_TOOL_GROUP = "solana";

export const solanaToolSchemas = {
  solana_wallet_overview: z.object({}).strict(),
  solana_token_balances: z.object({ limit: z.number().int().min(1).max(50) }).strict(),
  solana_recent_transactions: z.object({ limit: z.number().int().min(1).max(10) }).strict(),
  solana_explain_transaction: z.object({ signature: z.string().min(1).max(120) }).strict(),
  solana_token_info: z.object({ mint: z.string().min(1).max(64) }).strict(),
  solana_prepare_sol_transfer: z.object({ to: z.string().min(1).max(64), amountSol: z.number().positive().max(1_000_000) }).strict(),
  solana_prepare_token_transfer: z
    .object({ mint: z.string().min(1).max(64), to: z.string().min(1).max(64), amount: z.number().positive() })
    .strict(),
} as const;

export type SolanaToolName = keyof typeof solanaToolSchemas;

export const WRITE_TOOLS = new Set<SolanaToolName>(["solana_prepare_sol_transfer", "solana_prepare_token_transfer"]);

export const SOLANA_TOOLS: ToolDefinition[] = [
  {
    name: "solana_wallet_overview",
    description: "Read the connected wallet's SOL balance and its largest SPL token holdings. The wallet address is shown as a placeholder.",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "solana_token_balances",
    description: "List SPL token balances held by the connected wallet, largest first.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", description: "Maximum number of tokens to return (1-50)." } },
      required: ["limit"],
      additionalProperties: false,
    },
  },
  {
    name: "solana_recent_transactions",
    description: "List the connected wallet's most recent transactions (signature, time, status, SOL change).",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", description: "Number of transactions (1-10)." } },
      required: ["limit"],
      additionalProperties: false,
    },
  },
  {
    name: "solana_explain_transaction",
    description: 'Fetch a transaction and summarize its balance changes and programs. Pass "latest" for the wallet\'s most recent transaction.',
    inputSchema: {
      type: "object",
      properties: { signature: { type: "string", description: 'Transaction signature, a [TX_n] placeholder, or "latest".' } },
      required: ["signature"],
      additionalProperties: false,
    },
  },
  {
    name: "solana_token_info",
    description: "Read on-chain information about an SPL token mint: supply, decimals, authorities and metadata name/symbol when available.",
    inputSchema: {
      type: "object",
      properties: { mint: { type: "string", description: "Mint address or a [WALLET_n] placeholder." } },
      required: ["mint"],
      additionalProperties: false,
    },
  },
  {
    name: "solana_prepare_sol_transfer",
    description:
      "Prepare (do not send) a SOL transfer from the connected wallet. The user sees a preview and must approve it in their wallet. Never claim the transfer happened.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient address or a [WALLET_n] placeholder." },
        amountSol: { type: "number", description: "Amount in SOL." },
      },
      required: ["to", "amountSol"],
      additionalProperties: false,
    },
  },
  {
    name: "solana_prepare_token_transfer",
    description:
      "Prepare (do not send) an SPL token transfer from the connected wallet. The user sees a preview and must approve it in their wallet.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Token mint address or placeholder." },
        to: { type: "string", description: "Recipient wallet address or placeholder." },
        amount: { type: "number", description: "Amount in whole tokens (UI units)." },
      },
      required: ["mint", "to", "amount"],
      additionalProperties: false,
    },
  },
];

export function toolsForGroups(groups: string[] | undefined): ToolDefinition[] {
  if (!groups?.includes(SOLANA_TOOL_GROUP)) return [];
  return SOLANA_TOOLS;
}
