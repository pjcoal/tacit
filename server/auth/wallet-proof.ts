import "server-only";
import { randomBytes } from "node:crypto";
import bs58 from "bs58";
import { and, eq, isNull } from "drizzle-orm";
import nacl from "tweetnacl";
import { isBase58PublicKey } from "@/lib/solana/address";
import type { Db } from "@/server/db/client";
import { authNonces } from "@/server/db/schema";
import { env } from "@/server/env";
import { HttpError } from "@/server/http";

export type ProofPurpose = "admin" | "token_gate";

const NONCE_TTL_MS = 10 * 60_000;

/**
 * Sign-In-With-Solana style proof. The wallet signs a human-readable message
 * (never a transaction) containing a single-use server nonce.
 */
export async function createProofMessage(db: Db, purpose: ProofPurpose, host: string) {
  const nonce = randomBytes(16).toString("hex");
  await db.insert(authNonces).values({ nonce, purpose });
  const e = env();
  const action = purpose === "admin" ? "sign in to the admin console" : "prove you hold the project token";
  const message = [
    `${e.NEXT_PUBLIC_APP_NAME} wants you to ${action}.`,
    "",
    "Signing this message does not send a transaction, cost anything, or grant any spending permission.",
    "",
    `Domain: ${host}`,
    `Network: ${e.SOLANA_NETWORK}`,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join("\n");
  return { message, nonce };
}

function decodeSignature(sig: string): Uint8Array {
  if (/^[1-9A-HJ-NP-Za-km-z]+$/.test(sig)) {
    try {
      return bs58.decode(sig);
    } catch {}
  }
  return new Uint8Array(Buffer.from(sig, "base64"));
}

export async function verifyProof(
  db: Db,
  purpose: ProofPurpose,
  input: { publicKey: string; signature: string; message: string },
  expectedHost: string,
): Promise<string> {
  if (!isBase58PublicKey(input.publicKey)) throw new HttpError(400, "Invalid public key", "invalid_request");
  const nonce = /\nNonce: ([a-f0-9]{32})\n/.exec(input.message)?.[1];
  const domain = /\nDomain: (\S+)\n/.exec(input.message)?.[1];
  if (!nonce || domain !== expectedHost) throw new HttpError(400, "Message is not for this site", "invalid_proof");

  const sig = decodeSignature(input.signature);
  const ok =
    sig.length === 64 &&
    nacl.sign.detached.verify(new TextEncoder().encode(input.message), sig, bs58.decode(input.publicKey));
  if (!ok) throw new HttpError(401, "Signature verification failed", "invalid_proof");

  // Consume the nonce exactly once.
  const [row] = await db
    .update(authNonces)
    .set({ usedAt: new Date() })
    .where(and(eq(authNonces.nonce, nonce), eq(authNonces.purpose, purpose), isNull(authNonces.usedAt)))
    .returning();
  if (!row) throw new HttpError(401, "This sign-in request was already used or doesn't exist", "invalid_proof");
  if (Date.now() - row.createdAt.getTime() > NONCE_TTL_MS) throw new HttpError(401, "Sign-in request expired", "invalid_proof");
  return input.publicKey;
}

export function requestHost(req: Request): string {
  return req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(env().NEXT_PUBLIC_APP_URL).host;
}
