import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db/client";
import { route } from "@/server/http";
import { buybackOverview } from "@/server/services/buyback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  requireAdmin(req);
  return NextResponse.json(await buybackOverview(await getDb()), { headers: { "cache-control": "no-store" } });
});
