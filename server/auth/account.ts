import "server-only";
import { eq } from "drizzle-orm";
import type { NextResponse } from "next/server";
import { getDb, type Db } from "@/server/db/client";
import { accounts } from "@/server/db/schema";
import { HttpError } from "@/server/http";
import { ACCOUNT_SECRET_PREFIX, isAccountSecret, randomToken, sha256Hex } from "./secrets";

/**
 * Pseudonymous accounts. There is no email, password or wallet on file: an
 * account is a random id plus the hash of a bearer secret held by the user
 * (in an httpOnly cookie and in a recovery file they download once).
 */

export const ACCOUNT_COOKIE = "veil_acct";

export async function createAccount(db: Db): Promise<{ id: string; secret: string }> {
  const secret = randomToken(ACCOUNT_SECRET_PREFIX);
  const [row] = await db.insert(accounts).values({ secretHash: sha256Hex(secret) }).returning({ id: accounts.id });
  return { id: row.id, secret };
}

export async function findAccountBySecret(db: Db, secret: string) {
  if (!isAccountSecret(secret)) return null;
  const [row] = await db.select().from(accounts).where(eq(accounts.secretHash, sha256Hex(secret))).limit(1);
  return row ?? null;
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export type Account = typeof accounts.$inferSelect;

/** The account for this browser session, or null when anonymous. */
export async function getRequestAccount(req: Request): Promise<Account | null> {
  const secret = readCookie(req, ACCOUNT_COOKIE);
  if (!secret) return null;
  const db = await getDb();
  return findAccountBySecret(db, secret);
}

export async function requireAccount(req: Request): Promise<Account> {
  const acct = await getRequestAccount(req);
  if (!acct) throw new HttpError(401, "No account on this device yet. Create one or restore from your recovery file.", "no_account");
  return acct;
}

export function setAccountCookie(res: NextResponse, secret: string) {
  res.cookies.set(ACCOUNT_COOKIE, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
}

export function clearAccountCookie(res: NextResponse) {
  res.cookies.set(ACCOUNT_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "strict" });
}
