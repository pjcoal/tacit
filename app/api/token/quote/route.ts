import { NextResponse } from "next/server";
import { z } from "zod";
import { getTokenQuote } from "@/lib/solana/pump";
import { enforceRateLimit, HttpError, ipKey, parseJson, route } from "@/server/http";
import { lamportsAmount, pubkey, requireTokenMint, slippagePct } from "@/server/token-schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ lamports: lamportsAmount, slippagePct, user: pubkey.optional() });

export const POST = route(async (req: Request) => {
  await enforceRateLimit(`token-quote:${ipKey(req)}`, 60, 60_000);
  const mint = requireTokenMint();
  const body = await parseJson(req, schema, 4096);
  try {
    const quote = await getTokenQuote({ mint, side: "buy", amountIn: body.lamports, slippagePct: body.slippagePct, user: body.user });
    return NextResponse.json({ quote }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    throw new HttpError(502, (err as Error).message, "quote_failed");
  }
});
