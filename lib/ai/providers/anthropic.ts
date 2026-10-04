import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageParam, BetaContentBlockParam, BetaToolUnion } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { env } from "@/server/env";
import type { WireMessage } from "@/types/chat";
import { ProviderError, type ChatProvider, type ProviderChatRequest, type ProviderEvent } from "../types";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  const key = env().ANTHROPIC_API_KEY;
  if (!key) throw new ProviderError("Anthropic is not configured", 503, "provider_not_configured");
  const workspace = env().ANTHROPIC_WORKSPACE_ID;
  client ??= new Anthropic({
    apiKey: key,
    maxRetries: 2,
    ...(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {}),
  });
  return client;
}

// Models that accept server-side refusal fallbacks ("default" routing by refusal category).
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5", "claude-opus-5", "claude-fable-5-1"]);

function toAnthropicMessages(messages: WireMessage[]): BetaMessageParam[] {
  const out: BetaMessageParam[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      const content: BetaContentBlockParam[] = [];
      for (const img of m.images ?? []) {
        content.push({ type: "image", source: { type: "base64", media_type: img.mime, data: img.data } });
      }
      content.push({ type: "text", text: m.content || " " });
      out.push({ role: "user", content });
    } else if (m.role === "assistant") {
      // Replay the provider's own content blocks (thinking + tool_use) unchanged when we have them.
      if (Array.isArray(m.providerState) && m.providerState.length) {
        out.push({ role: "assistant", content: m.providerState as BetaContentBlockParam[] });
      } else {
        const content: BetaContentBlockParam[] = [];
        if (m.content) content.push({ type: "text", text: m.content });
        for (const tc of m.toolCalls ?? []) {
          content.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input as Record<string, unknown> });
        }
        out.push({ role: "assistant", content: content.length ? content : [{ type: "text", text: " " }] });
      }
    } else {
      // All tool results for one assistant turn go back in a single user message.
      const block: BetaContentBlockParam = {
        type: "tool_result",
        tool_use_id: m.toolCallId,
        content: m.content,
        ...(m.isError ? { is_error: true } : {}),
      };
      const last = out[out.length - 1];
      if (last?.role === "user" && Array.isArray(last.content) && last.content.every((b) => b.type === "tool_result")) {
        last.content.push(block);
      } else {
        out.push({ role: "user", content: [block] });
      }
    }
  }
  return out;
}

function thinkingParams(req: ProviderChatRequest) {
  const id = req.model.upstream;
  const level = req.reasoning;
  if (id.startsWith("claude-haiku-4-5")) {
    // Haiku 4.5 uses a fixed thinking budget and does not accept effort.
    if (level === "off") return { max_tokens: req.maxTokens ?? req.model.maxOutput };
    const budget = { low: 2048, medium: 6000, high: 12000 }[level];
    return { thinking: { type: "enabled" as const, budget_tokens: budget }, max_tokens: budget + (req.maxTokens ?? 8000) };
  }
  const max_tokens = req.maxTokens ?? req.model.maxOutput;
  if (level === "off" && id.startsWith("claude-sonnet-5-5")) {
    return { thinking: { type: "between_tools" as const }, output_config: { effort: "low" as const }, max_tokens };
  }
  // Opus 5.5 can't disable thinking; "off" maps to low effort.
  const effort = level === "off" ? "low" : level;
  return {
    thinking: { type: "adaptive" as const, display: "summarized" as const },
    output_config: { effort },
    max_tokens,
  };
}

export const anthropicProvider: ChatProvider = {
  id: "anthropic",
  async *streamChat(req: ProviderChatRequest): AsyncIterable<ProviderEvent> {
    const anthropic = getClient();
    const tools: BetaToolUnion[] = req.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as BetaToolUnion extends { input_schema: infer S } ? S : never,
      strict: true,
      eager_input_streaming: true,
    })) as BetaToolUnion[];

    const useFallback = FALLBACK_MODELS.has(req.model.upstream);
    const stream = anthropic.beta.messages.stream(
      {
        model: req.model.upstream,
        system: req.system,
        messages: toAnthropicMessages(req.messages),
        ...(tools.length ? { tools } : {}),
        ...thinkingParams(req),
        ...(useFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      },
      { signal: req.signal },
    );

    try {
      for await (const event of stream) {
        if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") yield { type: "text", delta: event.delta.text };
          else if (event.delta.type === "thinking_delta" && event.delta.thinking) {
            yield { type: "reasoning", delta: event.delta.thinking };
          }
        }
      }
      const final = await stream.finalMessage();
      yield { type: "usage", inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens };

      if (final.stop_reason === "refusal") {
        yield { type: "done", stopReason: "refusal" };
        return;
      }
      const toolUses = final.content.filter((b) => b.type === "tool_use");
      if (final.stop_reason === "max_tokens" && toolUses.length) {
        // A truncated tool input can't be trusted; surface it instead of executing.
        yield { type: "error", message: "The model's tool call was cut off. Try again.", code: "tool_truncated" };
        yield { type: "done", stopReason: "max_tokens" };
        return;
      }
      if (toolUses.length) {
        yield { type: "provider_state", state: final.content };
        for (const b of toolUses) {
          if (b.type === "tool_use") yield { type: "tool_call", id: b.id, name: b.name, input: b.input };
        }
        yield { type: "done", stopReason: "tool_use" };
        return;
      }
      yield { type: "done", stopReason: final.stop_reason === "max_tokens" ? "max_tokens" : "end" };
    } catch (err) {
      if (req.signal.aborted) {
        yield { type: "done", stopReason: "aborted" };
        return;
      }
      // Provider details go to server logs only; users get a message about *this* service.
      if (err instanceof Anthropic.APIError) console.error("[anthropic]", err.status, err.message);
      if (err instanceof Anthropic.RateLimitError) throw new ProviderError("The model provider is rate limiting requests. Try again shortly.", 429, "provider_rate_limited");
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
        throw new ProviderError(`${req.model.label} is temporarily unavailable.`, 503, "provider_unavailable");
      }
      if (err instanceof Anthropic.BadRequestError) {
        if (/credit balance|billing/i.test(err.message)) throw new ProviderError(`${req.model.label} is temporarily unavailable. Try another model.`, 503, "provider_unavailable");
        throw new ProviderError("The model rejected this request. Try rephrasing or shortening it.", 400, "provider_bad_request");
      }
      if (err instanceof Anthropic.APIError) throw new ProviderError(`Provider error (${err.status ?? "network"})`, 502);
      throw err;
    }
  },
};
