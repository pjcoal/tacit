import { Keypair, PublicKey, type ParsedTransactionWithMeta } from "@solana/web3.js";

export const SYSTEM = new PublicKey("11111111111111111111111111111111");
export const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

export const key = () => Keypair.generate().publicKey.toBase58();

interface TxOpts {
  payer: string;
  keys: Array<{ pubkey: string; signer?: boolean }>;
  instructions: Array<{ program: "system" | "spl-token"; type: string; info: Record<string, unknown> }>;
  preBalances?: number[];
  postBalances?: number[];
  preTokenBalances?: ParsedTransactionWithMeta["meta"] extends infer M ? (M extends { preTokenBalances?: infer T } ? T : never) : never;
  postTokenBalances?: ParsedTransactionWithMeta["meta"] extends infer M ? (M extends { postTokenBalances?: infer T } ? T : never) : never;
  err?: unknown;
  blockTime?: number;
}

/** Build a minimal parsed transaction shaped like getParsedTransaction's output. */
export function parsedTx(o: TxOpts): ParsedTransactionWithMeta {
  const accountKeys = o.keys.map((k) => ({ pubkey: new PublicKey(k.pubkey), signer: Boolean(k.signer), writable: true, source: "transaction" as const }));
  return {
    slot: 123,
    blockTime: o.blockTime ?? Math.floor(Date.now() / 1000),
    transaction: {
      signatures: ["sig"],
      message: {
        accountKeys,
        instructions: o.instructions.map((ix) => ({
          program: ix.program,
          programId: ix.program === "system" ? SYSTEM : TOKEN,
          parsed: { type: ix.type, info: ix.info },
        })),
        recentBlockhash: "x",
      },
    },
    meta: {
      err: (o.err ?? null) as never,
      fee: 5000,
      preBalances: o.preBalances ?? o.keys.map(() => 0),
      postBalances: o.postBalances ?? o.keys.map(() => 0),
      preTokenBalances: o.preTokenBalances ?? [],
      postTokenBalances: o.postTokenBalances ?? [],
      innerInstructions: [],
      logMessages: [],
    },
  } as unknown as ParsedTransactionWithMeta;
}
