import { NextResponse } from "next/server";
import { z } from "zod";
import { fixedCostCredits } from "@/lib/credits/calc";
import { generateImage } from "@/lib/ai/media";
import { IMAGE_MODELS, providerConfigured } from "@/lib/ai/registry";
import { ProviderError } from "@/lib/ai/types";
import { requireAccount } from "@/server/auth/account";
import { getDb } from "@/server/db/client";
import { env } from "@/server/env";
import { assertSameOrigin, enforceRateLimit, HttpError, parseJson, route } from "@/server/http";
import { getBalance, recordUsage } from "@/server/services/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const schema = z.object({
  model: z.string().max(64),
  prompt: z.string().trim().min(1).max(4000),
  aspectRatio: z.enum(["1:1", "3:2", "2:3", "16:9", "9:16"]),
  quality: z.enum(["low", "medium", "high"]).optional(),
});

const QUALITY_MULTIPLIER = { low: 0.25, medium: 1, high: 3 } as const;

/** Images are returned to the browser and stored there (IndexedDB); the server keeps no copy. */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const account = await requireAccount(req);
  await enforceRateLimit(`image:${account.id}`, 20, 60_000);
  const body = await parseJson(req, schema, 32 * 1024);
  const model = IMAGE_MODELS.find((m) => m.id === body.model);
  if (!model) throw new HttpError(400, "Unknown image model", "unknown_model");
  if (!providerConfigured(model.provider)) throw new HttpError(503, `${model.label} is not configured`, "model_unavailable");
  if (!model.aspectRatios.includes(body.aspectRatio)) throw new HttpError(400, `${model.label} doesn't support ${body.aspectRatio}`, "invalid_request");

  const e = env();
  const unitUsd = model.unitUsd * (model.qualities.length && body.quality ? QUALITY_MULTIPLIER[body.quality] : 1);
  const credits = fixedCostCredits(unitUsd, 1, e.PRICE_MARKUP_BPS, e.CREDITS_PER_USD);
  const db = await getDb();
  if ((await getBalance(db, account.id)) < credits) {
    throw new HttpError(402, `This image costs ${credits} credits. Add credits to continue.`, "insufficient_credits");
  }

  try {
    const image = await generateImage(model, body, req.signal);
    await recordUsage(db, {
      accountId: account.id,
      source: "app",
      kind: "image",
      model: model.id,
      provider: model.provider,
      units: 1,
      credits,
      providerCostUsd: unitUsd,
    });
    return NextResponse.json({ image, credits }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof ProviderError) throw new HttpError(err.status, err.message, err.code);
    throw err;
  }
});
