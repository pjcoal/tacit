import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, parseJson, route } from "@/server/http";
import { createProposal } from "@/server/services/buyback";

export const runtime = "nodejs";

/** Snapshot net revenue since the last proposal into a new proposal awaiting review. */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const admin = requireAdmin(req);
  const { notes } = await parseJson(req, z.object({ notes: z.string().max(1000).optional() }), 4096);
  const proposal = await createProposal(await getDb(), admin, notes);
  return NextResponse.json({ proposal }, { status: 201 });
});
