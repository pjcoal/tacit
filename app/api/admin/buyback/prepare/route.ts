import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, HttpError, parseJson, route } from "@/server/http";
import { prepareBuyback } from "@/server/services/buyback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Build (never sign) the buy transaction for an approved proposal. */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  requireAdmin(req);
  const body = await parseJson(req, z.object({ proposalId: z.uuid(), slippagePct: z.number().min(0.1).max(15) }), 2048);
  try {
    return NextResponse.json(await prepareBuyback(await getDb(), body.proposalId, body.slippagePct));
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, (err as Error).message, "build_failed");
  }
});
