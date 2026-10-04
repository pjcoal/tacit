import "server-only";
import type { NextResponse } from "next/server";
import { env } from "@/server/env";
import { HttpError } from "@/server/http";
import { signToken, verifyToken } from "@/server/signed";

export const ADMIN_COOKIE = "tacit_admin";
const SESSION_SECONDS = 8 * 60 * 60;

export function adminConfigured(): { ok: boolean; reason: string | null } {
  const e = env();
  if (!e.ADMIN_WALLETS.length) return { ok: false, reason: "ADMIN_WALLETS is not set" };
  if (!e.SERVER_SECRET) return { ok: false, reason: "SERVER_SECRET is not set" };
  return { ok: true, reason: null };
}

export function isAdminWallet(pk: string): boolean {
  return env().ADMIN_WALLETS.includes(pk);
}

export function setAdminCookie(res: NextResponse, wallet: string) {
  res.cookies.set(ADMIN_COOKIE, signToken({ wallet, role: "admin" }, SESSION_SECONDS), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export function clearAdminCookie(res: NextResponse) {
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "strict" });
}

/** Returns the signed-in admin wallet. Re-checks ADMIN_WALLETS on every request. */
export function requireAdmin(req: Request): string {
  const cfg = adminConfigured();
  if (!cfg.ok) throw new HttpError(503, `Admin console not configured: ${cfg.reason}`, "admin_not_configured");
  const cookie = req.headers.get("cookie") ?? "";
  const raw = cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${ADMIN_COOKIE}=`))
    ?.slice(ADMIN_COOKIE.length + 1);
  const data = raw ? verifyToken<{ wallet: string; role: string }>(decodeURIComponent(raw)) : null;
  if (!data || data.role !== "admin" || !isAdminWallet(data.wallet)) throw new HttpError(401, "Admin sign-in required", "admin_required");
  return data.wallet;
}
