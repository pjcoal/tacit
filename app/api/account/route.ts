import { NextResponse } from "next/server";
import { clearAccountCookie, createAccount, getRequestAccount, setAccountCookie } from "@/server/auth/account";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, enforceRateLimit, ipKey, route } from "@/server/http";
import { activeSubscription, getBalance } from "@/server/services/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  const account = await getRequestAccount(req);
  if (!account) return NextResponse.json({ account: null }, { headers: { "cache-control": "no-store" } });
  const db = await getDb();
  const [balance, sub] = await Promise.all([getBalance(db, account.id), activeSubscription(db, account.id)]);
  const tokenTierActive = Boolean(account.tokenTier && account.tokenTierExpiresAt && account.tokenTierExpiresAt > new Date());
  return NextResponse.json(
    {
      account: {
        createdAt: account.createdAt,
        balance,
        plan: sub ? { id: sub.plan, endsAt: sub.endsAt } : null,
        tokenTier: tokenTierActive ? account.tokenTier : null,
        tokenTierExpiresAt: tokenTierActive ? account.tokenTierExpiresAt : null,
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
});

/** Create a pseudonymous account for this device. The secret is returned once for the recovery file. */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await enforceRateLimit(`acct-create:${ipKey(req)}`, 5, 60 * 60_000);
  const existing = await getRequestAccount(req);
  if (existing) return NextResponse.json({ error: "This device already has an account.", code: "account_exists" }, { status: 409 });
  const { secret } = await createAccount(await getDb());
  const res = NextResponse.json({ secret }, { status: 201, headers: { "cache-control": "no-store" } });
  setAccountCookie(res, secret);
  return res;
});

/** Forget the account on this device (the account itself remains recoverable with the secret). */
export const DELETE = route(async (req: Request) => {
  assertSameOrigin(req);
  const res = NextResponse.json({ ok: true });
  clearAccountCookie(res);
  return res;
});
