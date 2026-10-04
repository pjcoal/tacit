import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, HttpError, parseJson, route } from "@/server/http";
import { reviewProposal } from "@/server/services/buyback";

export const runtime = "nodejs";

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const admin = requireAdmin(req);
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw new HttpError(400, "Invalid id", "invalid_request");
  const body = await parseJson(req, z.object({ action: z.enum(["approve", "reject"]), notes: z.string().max(1000).optional() }), 4096);
  const proposal = await reviewProposal(await getDb(), id, admin, body.action, body.notes);
  return NextResponse.json({ proposal });
});
