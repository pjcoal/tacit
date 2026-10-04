import { NextResponse } from "next/server";
import { z } from "zod";
import { findAccountBySecret, setAccountCookie } from "@/server/auth/account";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, enforceRateLimit, HttpError, ipKey, parseJson, route } from "@/server/http";

export const runtime = "nodejs";

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await enforceRateLimit(`acct-restore:${ipKey(req)}`, 10, 15 * 60_000);
  const { secret } = await parseJson(req, z.object({ secret: z.string().trim().min(10).max(200) }), 4096);
  const account = await findAccountBySecret(await getDb(), secret);
  if (!account) throw new HttpError(404, "That recovery key doesn't match any account.", "not_found");
  const res = NextResponse.json({ ok: true });
  setAccountCookie(res, secret);
  return res;
});
