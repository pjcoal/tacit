import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAccount } from "@/server/auth/account";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, enforceRateLimit, parseJson, route } from "@/server/http";
import { createPaymentIntent } from "@/server/services/payments";
import { pubkey } from "@/server/token-schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  kind: z.enum(["credits", "plan"]),
  productId: z.string().min(1).max(40),
  currency: z.enum(["SOL", "USDC", "BURN"]),
  payer: pubkey,
});

/** Quote + build an unsigned transfer for the user's wallet to sign. */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const account = await requireAccount(req);
  await enforceRateLimit(`pay-intent:${account.id}`, 20, 10 * 60_000);
  const body = await parseJson(req, schema, 4096);
  const result = await createPaymentIntent(await getDb(), account.id, body);
  return NextResponse.json(result, { status: 201, headers: { "cache-control": "no-store" } });
});
