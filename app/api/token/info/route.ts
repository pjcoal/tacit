import { NextResponse } from "next/server";
import { route } from "@/server/http";
import { getTokenInfo } from "@/server/services/token-info";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const info = await getTokenInfo();
  return NextResponse.json(info, { headers: { "cache-control": "public, max-age=15, stale-while-revalidate=30" } });
});
