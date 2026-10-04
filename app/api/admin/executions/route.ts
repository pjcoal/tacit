import { NextResponse } from "next/server";
import { z } from "zod";
import { isBase58Signature64 } from "@/lib/solana/address";
import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, parseJson, route } from "@/server/http";
import { recordExecution } from "@/server/services/buyback";

export const runtime = "nodejs";

const schema = z.object({
  kind: z.enum(["buy", "burn"]),
  signature: z.string().refine(isBase58Signature64, "invalid signature"),
  proposalId: z.uuid().optional(),
});

/** Log a treasury-signed transaction after verifying it on-chain. */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const admin = requireAdmin(req);
  const body = await parseJson(req, schema, 2048);
  const execution = await recordExecution(await getDb(), { ...body, admin });
  return NextResponse.json({ execution }, { status: 201 });
});
