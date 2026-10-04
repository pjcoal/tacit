import { NextResponse } from "next/server";
import { z } from "zod";
import { createProofMessage, requestHost } from "@/server/auth/wallet-proof";
import { getDb } from "@/server/db/client";
import { enforceRateLimit, ipKey, parseJson, route } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  await enforceRateLimit(`nonce:${ipKey(req)}`, 20, 10 * 60_000);
  const { purpose } = await parseJson(req, z.object({ purpose: z.enum(["admin", "token_gate"]) }), 1024);
  const { message } = await createProofMessage(await getDb(), purpose, requestHost(req));
  return NextResponse.json({ message }, { headers: { "cache-control": "no-store" } });
});
