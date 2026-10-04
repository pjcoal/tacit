import { NextResponse } from "next/server";
import { z } from "zod";
import { buildLaunchTransaction } from "@/lib/pump/launch";
import { requireAdmin } from "@/server/auth/admin";
import { env } from "@/server/env";
import { assertSameOrigin, HttpError, parseJson, route } from "@/server/http";
import { pubkey } from "@/server/token-schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(1).max(32),
  symbol: z.string().trim().min(1).max(10).regex(/^[A-Za-z0-9$]+$/, "letters and digits only"),
  uri: z.string().trim().max(200).regex(/^(https:\/\/|ipfs:\/\/)\S+$/, "must be an https:// or ipfs:// metadata URI"),
  mint: pubkey,
  initialBuySol: z.number().min(0).max(85),
  confirmMainnet: z.string().max(64).optional(),
});

/**
 * Admin-only. Returns an unsigned create transaction. Mainnet requires
 * ALLOW_MAINNET_TOKEN_CREATION=true *and* a typed confirmation phrase, and the
 * admin wallet still has to approve the transaction itself.
 */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const admin = requireAdmin(req);
  const body = await parseJson(req, schema, 8192);
  const e = env();
  if (e.SOLANA_NETWORK === "mainnet-beta") {
    if (!e.ALLOW_MAINNET_TOKEN_CREATION) {
      throw new HttpError(403, "Mainnet token creation is disabled. Set ALLOW_MAINNET_TOKEN_CREATION=true to enable it.", "mainnet_disabled");
    }
    const phrase = `LAUNCH ${body.symbol.toUpperCase()} ON MAINNET`;
    if (body.confirmMainnet !== phrase) throw new HttpError(400, `Type "${phrase}" to confirm a mainnet launch.`, "confirmation_required");
  }
  try {
    const built = await buildLaunchTransaction({
      name: body.name,
      symbol: body.symbol,
      uri: body.uri,
      mint: body.mint,
      creator: admin,
      initialBuyLamports: BigInt(Math.round(body.initialBuySol * 1e9)),
    });
    return NextResponse.json({ ...built, network: e.SOLANA_NETWORK, creator: admin });
  } catch (err) {
    throw new HttpError(502, (err as Error).message, "build_failed");
  }
});
