import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { createPlaceholderMap, restorePartial, restoreResponse, sanitizePrompt } from "@/lib/privacy";
import { LIMITS, parseImageDataUrl } from "@/lib/security/uploads";
import { authenticateApiKey, bearerToken } from "@/server/auth/api-keys";
import { isApiKey } from "@/server/auth/secrets";
import { getDb } from "@/server/db/client";
import { enforceRateLimit, HttpError, ipKey, parseJson, rateLimitHeaders } from "@/server/http";
import { prepareChat, runChat, type ChatInput } from "@/server/services/chat";
import type { WireImage, WireMessage } from "@/types/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const contentPart = z.union([
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("image_url"), image_url: z.object({ url: z.string() }) }),
]);

const bodySchema = z.object({
  model: z.string().min(1).max(64),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "developer", "user", "assistant"]),
        content: z.union([z.string().max(LIMITS.maxMessageChars), z.array(contentPart).max(16)]).nullable(),
      }),
    )
    .min(1)
    .max(LIMITS.maxMessages),
  stream: z.boolean().optional(),
  max_tokens: z.number().int().positive().max(64_000).optional(),
  max_completion_tokens: z.number().int().positive().max(64_000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  /** Extension: run the privacy filter server-side before the provider sees the prompt. */
  privacy: z.enum(["smart", "strict", "off"]).optional(),
});

function openAIError(status: number, message: string, code: string, headers: Record<string, string> = {}) {
  return NextResponse.json(
    { error: { message, type: status === 401 ? "authentication_error" : status === 429 ? "rate_limit_error" : "invalid_request_error", code } },
    { status, headers },
  );
}

export async function POST(req: Request) {
  try {
    // Reject missing/malformed keys before touching the database.
    const token = bearerToken(req);
    if (!token) throw new HttpError(401, "Missing API key. Send `Authorization: Bearer <key>`.", "missing_api_key");
    if (!isApiKey(token)) throw new HttpError(401, "Malformed API key.", "invalid_api_key");
    const db = await getDb();
    const { keyId, accountId } = await authenticateApiKey(db, token);
    const rl = await enforceRateLimit(`api:${keyId}`, 120, 60_000);
    const body = await parseJson(req, bodySchema);

    const mode = body.privacy ?? "off";
    let map = createPlaceholderMap();
    const system: string[] = [];
    const messages: WireMessage[] = [];
    for (const m of body.messages) {
      const parts = typeof m.content === "string" ? [{ type: "text" as const, text: m.content }] : (m.content ?? []);
      let text = parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("\n");
      const images: WireImage[] = [];
      for (const p of parts) {
        if (p.type !== "image_url") continue;
        if (!p.image_url.url.startsWith("data:")) {
          throw new HttpError(400, "Only base64 data: image URLs are accepted (remote URLs are not fetched).", "unsupported_image_url");
        }
        try {
          images.push(parseImageDataUrl(p.image_url.url));
        } catch (e) {
          throw new HttpError(400, (e as Error).message, "invalid_image");
        }
      }
      if (mode !== "off" && (m.role === "user" || m.role === "system" || m.role === "developer")) {
        const r = sanitizePrompt(text, mode, map);
        map = r.map;
        text = r.sanitized;
      }
      if (m.role === "system" || m.role === "developer") system.push(text);
      else if (m.role === "user") messages.push({ role: "user", content: text, ...(images.length ? { images } : {}) });
      else messages.push({ role: "assistant", content: text });
    }
    if (!messages.length) throw new HttpError(400, "At least one user message is required.", "invalid_request");

    const ctx = { accountId, apiKeyId: keyId, source: "api" as const, ipKey: ipKey(req) };
    const input: ChatInput = {
      modelId: body.model,
      messages,
      maxTokens: body.max_completion_tokens ?? body.max_tokens,
      temperature: body.temperature,
      extraSystem: system.length ? `Instructions from the API caller:\n${system.join("\n\n")}` : undefined,
    };
    const prepared = await prepareChat(ctx, input);
    const events = runChat(ctx, input, prepared, req.signal);

    const id = `chatcmpl-${crypto.randomUUID().replace(/-/g, "")}`;
    const created = Math.floor(Date.now() / 1000);
    const modelId = prepared.model.id;

    if (body.stream) {
      const encoder = new TextEncoder();
      let raw = "";
      let emitted = 0;
      const chunk = (delta: Record<string, unknown>, finish: string | null, extra: Record<string, unknown> = {}) =>
        encoder.encode(
          `data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model: modelId, choices: [{ index: 0, delta, finish_reason: finish }], ...extra })}\n\n`,
        );
      let cancelled = false;
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          // The client may disconnect mid-stream; never enqueue into a closed stream.
          const send = (bytes: Uint8Array) => {
            if (!cancelled) controller.enqueue(bytes);
          };
          send(chunk({ role: "assistant" }, null));
          let finish = "stop";
          let usage: Record<string, number> | undefined;
          for await (const ev of events) {
            if (ev.type === "text") {
              raw += ev.delta;
              const visible = mode === "off" ? raw : restorePartial(raw, map);
              if (visible.length > emitted) {
                send(chunk({ content: visible.slice(emitted) }, null));
                emitted = visible.length;
              }
            } else if (ev.type === "usage") {
              usage = { prompt_tokens: ev.inputTokens, completion_tokens: ev.outputTokens, total_tokens: ev.inputTokens + ev.outputTokens, credits: ev.credits };
            } else if (ev.type === "done") {
              finish = ev.stopReason === "max_tokens" ? "length" : ev.stopReason === "refusal" ? "content_filter" : "stop";
            } else if (ev.type === "error") {
              send(encoder.encode(`data: ${JSON.stringify({ error: { message: ev.message, code: ev.code ?? "provider_error" } })}\n\n`));
            }
          }
          const final = mode === "off" ? raw : restoreResponse(raw, map);
          if (final.length > emitted) send(chunk({ content: final.slice(emitted) }, null));
          send(chunk({}, finish, usage ? { usage } : {}));
          send(encoder.encode("data: [DONE]\n\n"));
          if (!cancelled) controller.close();
        },
        async cancel() {
          cancelled = true;
          await events.return(undefined);
        },
      });
      return new Response(stream, {
        headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store, no-transform", ...rateLimitHeaders(rl) },
      });
    }

    let text = "";
    let finish = "stop";
    let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, credits: 0 };
    for await (const ev of events) {
      if (ev.type === "text") text += ev.delta;
      else if (ev.type === "usage") usage = { prompt_tokens: ev.inputTokens, completion_tokens: ev.outputTokens, total_tokens: ev.inputTokens + ev.outputTokens, credits: ev.credits };
      else if (ev.type === "done") finish = ev.stopReason === "max_tokens" ? "length" : ev.stopReason === "refusal" ? "content_filter" : "stop";
      else if (ev.type === "error") return openAIError(502, ev.message, ev.code ?? "provider_error", rateLimitHeaders(rl));
    }
    return NextResponse.json(
      {
        id,
        object: "chat.completion",
        created,
        model: modelId,
        choices: [{ index: 0, message: { role: "assistant", content: mode === "off" ? text : restoreResponse(text, map) }, finish_reason: finish }],
        usage,
      },
      { headers: rateLimitHeaders(rl) },
    );
  } catch (err) {
    if (err instanceof HttpError) return openAIError(err.status, err.message, err.code, err.headers);
    if (err instanceof ZodError) return openAIError(400, err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), "invalid_request");
    console.error("[api/v1] unhandled", err);
    return openAIError(500, "Internal error", "internal");
  }
}
