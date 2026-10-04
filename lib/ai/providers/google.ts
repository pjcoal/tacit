import "server-only";
import { env } from "@/server/env";
import { readSse } from "../sse";
import { ProviderError, type ChatProvider, type ProviderChatRequest, type ProviderEvent } from "../types";

/** Gemini via the Generative Language REST API (streamGenerateContent, SSE). Tools are not wired for Gemini yet. */
export const googleProvider: ChatProvider = {
  id: "google",
  async *streamChat(req: ProviderChatRequest): AsyncIterable<ProviderEvent> {
    const key = env().GOOGLE_API_KEY;
    if (!key) throw new ProviderError("Google is not configured", 503, "provider_not_configured");

    const contents = req.messages
      .filter((m) => m.role !== "tool")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [
          ...(m.role === "user" ? (m.images ?? []).map((i) => ({ inline_data: { mime_type: i.mime, data: i.data } })) : []),
          { text: m.content || " " },
        ],
      }));

    // Gemini 3+ (and the -latest aliases) take a thinking *level*; older models take a token budget.
    // Gemini 3 Flash can't fully disable thinking, so "off" maps to its lowest supported level.
    const levelBased = /^gemini-([3-9]|\d{2})|-latest$/.test(req.model.upstream);
    const thinkingBudget = { off: 0, low: 2048, medium: 8192, high: 24576 }[req.reasoning];
    const isPro = req.model.upstream.includes("pro");
    const thinkingConfig = levelBased
      ? { thinkingLevel: req.reasoning === "off" ? "low" : req.reasoning, includeThoughts: req.reasoning !== "off" }
      : { thinkingBudget: isPro && thinkingBudget === 0 ? 128 : thinkingBudget, includeThoughts: thinkingBudget > 0 };
    const body = {
      contents,
      systemInstruction: { parts: [{ text: req.system }] },
      generationConfig: {
        maxOutputTokens: (req.maxTokens ?? req.model.maxOutput) + (levelBased ? 8192 : thinkingBudget || 0),
        thinkingConfig,
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(req.model.upstream)}:streamGenerateContent?alt=sse`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
        signal: req.signal,
      });
    } catch (err) {
      if (req.signal.aborted) {
        yield { type: "done", stopReason: "aborted" };
        return;
      }
      throw new ProviderError(`Could not reach Google: ${(err as Error).message}`);
    }
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      console.error("[google]", res.status, text.slice(0, 500));
      throw new ProviderError(res.status === 429 ? "The model provider is rate limiting requests. Try again shortly." : `${req.model.label} is temporarily unavailable. Try another model.`, res.status === 429 ? 429 : 503, "provider_unavailable");
    }

    let usage = { inputTokens: 0, outputTokens: 0 };
    let finish: string | undefined;
    try {
      for await (const data of readSse(res.body, req.signal)) {
        let chunk: {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }>;
          usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
        };
        try {
          chunk = JSON.parse(data);
        } catch {
          continue;
        }
        const cand = chunk.candidates?.[0];
        for (const p of cand?.content?.parts ?? []) {
          if (!p.text) continue;
          yield p.thought ? { type: "reasoning", delta: p.text } : { type: "text", delta: p.text };
        }
        if (cand?.finishReason) finish = cand.finishReason;
        if (chunk.usageMetadata) {
          usage = {
            inputTokens: chunk.usageMetadata.promptTokenCount ?? 0,
            outputTokens: (chunk.usageMetadata.candidatesTokenCount ?? 0) + (chunk.usageMetadata.thoughtsTokenCount ?? 0),
          };
        }
      }
    } catch (err) {
      if (req.signal.aborted) {
        yield { type: "usage", ...usage };
        yield { type: "done", stopReason: "aborted" };
        return;
      }
      throw err;
    }
    yield { type: "usage", ...usage };
    if (!finish) {
      // The stream closed without a finish reason: the provider dropped the connection mid-answer.
      yield { type: "error", message: `${req.model.label} stopped responding mid-answer. Try again.`, code: "provider_incomplete" };
      yield { type: "done", stopReason: "error" };
      return;
    }
    yield {
      type: "done",
      stopReason: finish === "MAX_TOKENS" ? "max_tokens" : finish === "SAFETY" || finish === "PROHIBITED_CONTENT" ? "refusal" : "end",
    };
  },
};
