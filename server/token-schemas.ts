import "server-only";
import { z } from "zod";
import { isBase58PublicKey } from "@/lib/solana/address";
import { env } from "@/server/env";
import { HttpError } from "@/server/http";

export const pubkey = z.string().refine(isBase58PublicKey, "must be a Solana public key");

export const lamportsAmount = z
  .string()
  .regex(/^\d{1,15}$/, "must be an integer amount in lamports")
  .transform((s) => BigInt(s))
  .refine((n) => n >= 1_000_000n, "minimum is 0.001 SOL")
  .refine((n) => n <= 1_000_000_000_000n, "maximum is 1,000 SOL");

export const slippagePct = z.number().min(0.1).max(25);

export function requireTokenMint(): string {
  const mint = env().PROJECT_TOKEN_MINT;
  if (!mint) throw new HttpError(503, "The project token has not launched yet.", "token_not_configured");
  return mint;
}
