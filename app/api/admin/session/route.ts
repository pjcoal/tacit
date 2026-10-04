import { NextResponse } from "next/server";
import { z } from "zod";
import { adminConfigured, clearAdminCookie, isAdminWallet, requireAdmin, setAdminCookie } from "@/server/auth/admin";
import { requestHost, verifyProof } from "@/server/auth/wallet-proof";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, enforceRateLimit, HttpError, ipKey, parseJson, route } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  const cfg = adminConfigured();
  if (!cfg.ok) return NextResponse.json({ configured: false, reason: cfg.reason, wallet: null });
  try {
    return NextResponse.json({ configured: true, wallet: requireAdmin(req) });
  } catch {
    return NextResponse.json({ configured: true, wallet: null });
  }
});

const schema = z.object({ publicKey: z.string(), signature: z.string().max(200), message: z.string().max(2000) });

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await enforceRateLimit(`admin-login:${ipKey(req)}`, 10, 15 * 60_000);
  const cfg = adminConfigured();
  if (!cfg.ok) throw new HttpError(503, `Admin console not configured: ${cfg.reason}`, "admin_not_configured");
  const body = await parseJson(req, schema, 4096);
  const wallet = await verifyProof(await getDb(), "admin", body, requestHost(req));
  if (!isAdminWallet(wallet)) throw new HttpError(403, "This wallet is not an admin", "forbidden");
  const res = NextResponse.json({ wallet });
  setAdminCookie(res, wallet);
  return res;
});

export const DELETE = route(async (req: Request) => {
  assertSameOrigin(req);
  const res = NextResponse.json({ ok: true });
  clearAdminCookie(res);
  return res;
});
