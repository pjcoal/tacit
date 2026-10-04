import { NextResponse } from "next/server";
import { z } from "zod";
import { getVideoStatus } from "@/lib/ai/media";
import { ProviderError } from "@/lib/ai/types";
import { requireAccount } from "@/server/auth/account";
import { getDb } from "@/server/db/client";
import { enforceRateLimit, HttpError, parseJson, route } from "@/server/http";
import { refundCredits } from "@/server/services/ledger";
import { verifyToken } from "@/server/signed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  const account = await requireAccount(req);
  await enforceRateLimit(`video-status:${account.id}`, 120, 60_000);
  const { job } = await parseJson(req, z.object({ job: z.string().max(1024) }), 2048);
  const data = verifyToken<{ jobId: string; accountId: string; credits: number }>(job);
  if (!data || data.accountId !== account.id) throw new HttpError(404, "Unknown job", "not_found");
  try {
    const status = await getVideoStatus(data.jobId);
    let refunded = false;
    if (status.status === "failed") {
      // Idempotent: the ledger's (ref_type, ref_id) unique index allows one refund per job.
      refunded = await refundCredits(await getDb(), account.id, data.credits, "video_job", data.jobId);
    }
    return NextResponse.json({ ...status, refunded }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof ProviderError) throw new HttpError(err.status, err.message, err.code);
    throw err;
  }
});
