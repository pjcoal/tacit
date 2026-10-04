import { getRequestAccount } from "@/server/auth/account";
import { assertSameOrigin, enforceRateLimit, ipKey, parseJson, rateLimitHeaders, route } from "@/server/http";
import { chatRequestSchema } from "@/server/schemas";
import { agentSystem, prepareChat, runChat } from "@/server/services/chat";
import { ndjsonResponse } from "@/server/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * App chat endpoint. The browser has already sanitized user text; this route
 * forwards it to the provider and meters usage. Nothing is logged or stored
 * apart from token counts.
 */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const body = await parseJson(req, chatRequestSchema);
  const account = await getRequestAccount(req);
  const ip = ipKey(req);
  const rl = await enforceRateLimit(account ? `chat:acct:${account.id}` : `chat:ip:${ip}`, account ? 60 : 20, 60_000);

  const tokenHolder = Boolean(
    account?.tokenTier && account.tokenTierExpiresAt && account.tokenTierExpiresAt.getTime() > Date.now(),
  );
  const ctx = { accountId: account?.id ?? null, source: "app" as const, ipKey: ip, tokenHolder };
  const input = {
    modelId: body.model,
    messages: body.messages,
    reasoning: body.reasoning,
    toolGroups: body.mode === "code" ? [] : body.tools,
    mode: body.mode,
    extraSystem: body.agent && body.mode !== "code" ? agentSystem(body.agent) : undefined,
  };
  const prepared = await prepareChat(ctx, input);

  return ndjsonResponse(runChat(ctx, input, prepared, req.signal), rateLimitHeaders(rl));
});
