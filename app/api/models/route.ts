import { NextResponse } from "next/server";
import { publicChatModels, publicImageModels, publicVideoModels } from "@/lib/ai/registry";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";

/** Catalogue with live availability; unconfigured providers are reported as unavailable. */
export async function GET() {
  const e = env();
  return NextResponse.json(
    {
      chat: publicChatModels(e.CREDITS_PER_USD, e.PRICE_MARKUP_BPS),
      image: publicImageModels(),
      video: publicVideoModels(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
