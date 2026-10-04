import { NextResponse } from "next/server";
import { z } from "zod";
import { fixedCostCredits } from "@/lib/credits/calc";
import { startVideo } from "@/lib/ai/media";
import { providerConfigured, VIDEO_MODELS } from "@/lib/ai/registry";
import { ProviderError } from "@/lib/ai/types";
import { parseImageDataUrl } from "@/lib/security/uploads";
import { requireAccount } from "@/server/auth/account";
import { getDb } from "@/server/db/client";
import { env } from "@/server/env";
import { assertSameOrigin, enforceRateLimit, HttpError, parseJson, route } from "@/server/http";
import { getBalance, recordUsage } from "@/server/services/ledger";
import { signToken } from "@/server/signed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  model: z.string().max(64),
  prompt: z.string().trim().min(1).max(2000),
  durationSec: z.number().int().min(1).max(20),
  resolution: z.string().max(16),
  image: z.string().max(8 * 1024 * 1024).optional(),
});

/** Starts an async generation. Credits are charged up front and refunded automatically if the job fails. */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const account = await requireAccount(req);
  await enforceRateLimit(`video:${account.id}`, 5, 60_000);
  const body = await parseJson(req, schema, 9 * 1024 * 1024);
  const model = VIDEO_MODELS.find((m) => m.id === body.model);
  if (!model) throw new HttpError(400, "Unknown video model", "unknown_model");
  if (!providerConfigured(model.provider)) throw new HttpError(503, `${model.label} is not configured`, "model_unavailable");
  if (!model.durations.includes(body.durationSec)) throw new HttpError(400, `Duration must be one of ${model.durations.join(", ")}s`, "invalid_request");
  if (!model.resolutions.includes(body.resolution)) throw new HttpError(400, `Resolution must be one of ${model.resolutions.join(", ")}`, "invalid_request");
  if (body.image && !model.imageToVideo) throw new HttpError(400, `${model.label} doesn't accept a start image`, "invalid_request");
  if (!body.image && !model.textToVideo) throw new HttpError(400, `${model.label} needs a start image`, "invalid_request");
  if (body.image) {
    try {
      parseImageDataUrl(body.image, 6 * 1024 * 1024);
    } catch (e) {
      throw new HttpError(400, (e as Error).message, "invalid_image");
    }
  }

  const e = env();
  const credits = fixedCostCredits(model.unitUsdPerSecond, body.durationSec, e.PRICE_MARKUP_BPS, e.CREDITS_PER_USD);
  const db = await getDb();
  if ((await getBalance(db, account.id)) < credits) {
    throw new HttpError(402, `This video costs ${credits} credits. Add credits to continue.`, "insufficient_credits");
  }

  let jobId: string;
  try {
    jobId = await startVideo(model, { prompt: body.prompt, durationSec: body.durationSec, resolution: body.resolution, imageDataUrl: body.image });
  } catch (err) {
    if (err instanceof ProviderError) throw new HttpError(err.status, err.message, err.code);
    throw err;
  }
  await recordUsage(db, {
    accountId: account.id,
    source: "app",
    kind: "video",
    model: model.id,
    provider: model.provider,
    units: body.durationSec,
    credits,
    providerCostUsd: model.unitUsdPerSecond * body.durationSec,
  });
  const job = signToken({ jobId, accountId: account.id, credits }, 24 * 60 * 60);
  return NextResponse.json({ job, credits }, { status: 202, headers: { "cache-control": "no-store" } });
});
