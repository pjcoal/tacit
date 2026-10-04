import { NextResponse } from "next/server";
import { z } from "zod";
import { prepareBuyTransaction } from "@/lib/solana/pump";
import { assertSameOrigin, enforceRateLimit, HttpError, ipKey, parseJson, route } from "@/server/http";
import { lamportsAmount, pubkey, requireTokenMint, slippagePct } from "@/server/token-schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ user: pubkey, lamports: lamportsAmount, slippagePct });

/** Returns an UNSIGNED transaction. The user's wallet reviews and signs it; we never can. */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await enforceRateLimit(`token-buy:${ipKey(req)}`, 20, 60_000);
  const mint = requireTokenMint();
  const body = await parseJson(req, schema, 4096);
  try {
    const built = await prepareBuyTransaction({ mint, user: body.user, lamports: body.lamports, slippagePct: body.slippagePct });
    return NextResponse.json(built, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    throw new HttpError(502, (err as Error).message, "build_failed");
  }
});
