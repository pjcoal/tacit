import { NextResponse } from "next/server";
import { publicChatModels } from "@/lib/ai/registry";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";

/** OpenAI-style model list. Only configured models are returned. */
export async function GET() {
  const e = env();
  const data = publicChatModels(e.CREDITS_PER_USD, e.PRICE_MARKUP_BPS)
    .filter((m) => m.available)
    .map((m) => ({ id: m.id, object: "model", created: 0, owned_by: m.providerLabel, name: m.label }));
  return NextResponse.json({ object: "list", data });
}
