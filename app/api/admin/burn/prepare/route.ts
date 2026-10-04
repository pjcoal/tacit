import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/admin";
import { assertSameOrigin, parseJson, route } from "@/server/http";
import { prepareBurn } from "@/server/services/buyback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Build (never sign) an SPL burn of treasury-held tokens. */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  requireAdmin(req);
  const { amount } = await parseJson(req, z.object({ amount: z.number().positive().max(1e15) }), 1024);
  return NextResponse.json(await prepareBurn(amount));
});
