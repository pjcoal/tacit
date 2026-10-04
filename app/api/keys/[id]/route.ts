import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAccount } from "@/server/auth/account";
import { revokeApiKey } from "@/server/auth/api-keys";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, HttpError, route } from "@/server/http";

export const runtime = "nodejs";

export const DELETE = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const account = await requireAccount(req);
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw new HttpError(400, "Invalid key id", "invalid_request");
  const ok = await revokeApiKey(await getDb(), account.id, id);
  if (!ok) throw new HttpError(404, "Key not found or already revoked", "not_found");
  return NextResponse.json({ ok: true });
});
