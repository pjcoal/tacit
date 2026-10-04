import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/server/env";
import { enforceRateLimit, HttpError, ipKey, parseJson, route } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * JSON-RPC proxy for the browser when no public RPC URL is configured. Only
 * read methods plus sendTransaction / simulateTransaction (which carry an
 * already wallet-signed payload) are allowed; requests are rate limited and
 * nothing is logged.
 */
const ALLOWED = new Set([
  "getAccountInfo", "getBalance", "getBlockHeight", "getEpochInfo", "getFeeForMessage", "getGenesisHash",
  "getLatestBlockhash", "getMinimumBalanceForRentExemption", "getMultipleAccounts", "getRecentPrioritizationFees",
  "getSignatureStatuses", "getSignaturesForAddress", "getSlot", "getTokenAccountBalance", "getTokenAccountsByOwner",
  "getTokenLargestAccounts", "getTokenSupply", "getTransaction", "getVersion", "isBlockhashValid",
  "sendTransaction", "simulateTransaction",
]);

const call = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string().max(64), z.number()]).optional(),
  method: z.string().max(64),
  params: z.array(z.unknown()).max(8).optional(),
});
const body = z.union([call, z.array(call).min(1).max(10)]);

export const POST = route(async (req: Request) => {
  await enforceRateLimit(`rpc:${ipKey(req)}`, 240, 60_000);
  const payload = await parseJson(req, body, 256 * 1024);
  const calls = Array.isArray(payload) ? payload : [payload];
  for (const c of calls) {
    if (!ALLOWED.has(c.method)) throw new HttpError(403, `RPC method ${c.method} is not allowed`, "method_not_allowed");
  }
  const upstream = await fetch(env().rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!upstream) throw new HttpError(502, "RPC unavailable", "rpc_unavailable");
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
});
