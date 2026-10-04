import "server-only";
import { env } from "@/server/env";
import type { WireMessage } from "@/types/chat";
import { readSse } from "../sse";
import { ProviderError, type ChatProvider, type ProviderChatRequest, type ProviderEvent, type ProviderId } from "../types";

type CompatProvider = Extract<ProviderId, "openai" | "openrouter" | "together" | "fireworks" | "custom">;

interface Endpoint {
  baseUrl: string;
  apiKey: string;
  headers?: Record<string, string>;
}

export function compatEndpoint(provider: CompatProvider): Endpoint {
  const e = env();
  const missing = () => new ProviderError(`${provider} is not configured`, 503, "provider_not_configured");
  switch (provider) {
    case "openai":
      if (!e.OPENAI_API_KEY) throw missing();
      return { baseUrl: "https://api.openai.com/v1", apiKey: e.OPENAI_API_KEY };
    case "openrouter":
      if (!e.OPENROUTER_API_KEY) throw missing();
      return {
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: e.OPENROUTER_API_KEY,
        headers: { "HTTP-Referer": e.NEXT_PUBLIC_APP_URL, "X-Title": e.NEXT_PUBLIC_APP_NAME },
      };
    case "together":
      if (!e.TOGETHER_API_KEY) throw missing();
      return { baseUrl: "https://api.together.xyz/v1", apiKey: e.TOGETHER_API_KEY };
    case "fireworks":
      if (!e.FIREWORKS_API_KEY) throw missing();
      return { baseUrl: "https://api.fireworks.ai/inference/v1", apiKey: e.FIREWORKS_API_KEY };
    case "custom":
      if (!e.OPENAI_COMPATIBLE_BASE_URL || !e.OPENAI_COMPATIBLE_API_KEY) throw missing();
      return { baseUrl: e.OPENAI_COMPATIBLE_BASE_URL.replace(/\/$/, ""), apiKey: e.OPENAI_COMPATIBLE_API_KEY };
  }
}

type OAContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
type OAMessage =
  | { role: "system" | "user"; content: OAContent }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
    }
  | { role: "tool"; tool_call_id: string; content: string };

export function toOpenAIMessages(system: string, messages: WireMessage[]): OAMessage[] {
  const out: OAMessage[] = system ? [{ role: "system", content: system }] : [];
  for (const m of messages) {
    if (m.role === "user") {
      if (m.images?.length) {
        out.push({
          role: "user",
          content: [
            ...m.images.map((i) => ({ type: "image_url" as const, image_url: { url: `data:${i.mime};base64,${i.data}` } })),
            { type: "text" as const, text: m.content },
          ],
        });
      } else out.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      out.push({
        role: "assistant",
        content: m.content || null,
        ...(m.toolCalls?.length
          ? {
              tool_calls: m.toolCalls.map((tc) => ({
                id: tc.id,
                type: "function" as const,
                function: { name: tc.name, arguments: JSON.stringify(tc.input ?? {}) },
              })),
            }
          : {}),
      });
    } else {
      out.push({ role: "tool", tool_call_id: m.toolCallId, content: m.content });
    }
  }
  return out;
}

export function createCompatProvider(provider: CompatProvider): ChatProvider {
  return {
    id: provider,
    async *streamChat(req: ProviderChatRequest): AsyncIterable<ProviderEvent> {
      const ep = compatEndpoint(provider);
      const isOpenAI = provider === "openai";
      const body: Record<string, unknown> = {
        model: req.model.upstream,
        messages: toOpenAIMessages(req.system, req.messages),
        stream: true,
        stream_options: { include_usage: true },
        [isOpenAI ? "max_completion_tokens" : "max_tokens"]: req.maxTokens ?? req.model.maxOutput,
      };
      if (req.temperature !== undefined && !isOpenAI) body.temperature = req.temperature;
      if (isOpenAI && req.model.reasoning.length && req.reasoning !== "off") body.reasoning_effort = req.reasoning;
      if (isOpenAI && req.model.reasoning.length && req.reasoning === "off") body.reasoning_effort = "minimal";
      if (req.tools.length) {
        body.tools = req.tools.map((t) => ({
          type: "function",
          function: { name: t.name, description: t.description, parameters: t.inputSchema },
        }));
      }

      let res: Response;
      try {
        res = await fetch(`${ep.baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${ep.apiKey}`, ...ep.headers },
          body: JSON.stringify(body),
          signal: req.signal,
        });
      } catch (err) {
        if (req.signal.aborted) {
          yield { type: "done", stopReason: "aborted" };
          return;
        }
        throw new ProviderError(`Could not reach ${provider}: ${(err as Error).message}`);
      }
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        console.error(`[${provider}]`, res.status, text.slice(0, 500));
        if (res.status === 429) throw new ProviderError("The model provider is rate limiting requests. Try again shortly.", 429, "provider_rate_limited");
        if (res.status === 401 || res.status === 402 || res.status === 403 || res.status >= 500) {
          throw new ProviderError(`${req.model.label} is temporarily unavailable. Try another model.`, 503, "provider_unavailable");
        }
        throw new ProviderError("The model rejected this request. Try rephrasing or shortening it.", 400, "provider_bad_request");
      }

      const toolAcc = new Map<number, { id: string; name: string; args: string }>();
      let finish: string | null = null;
      let usage: { inputTokens: number; outputTokens: number } | null = null;
      try {
        for await (const data of readSse(res.body, req.signal)) {
          if (data === "[DONE]") break;
          let chunk: {
            choices?: Array<{
              delta?: {
                content?: string | null;
                reasoning?: string | null;
                reasoning_content?: string | null;
                tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }>;
              };
              finish_reason?: string | null;
            }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
            error?: { message?: string };
          };
          try {
            chunk = JSON.parse(data);
          } catch {
            continue;
          }
          if (chunk.error) throw new ProviderError(`${provider}: ${chunk.error.message ?? "stream error"}`);
          const choice = chunk.choices?.[0];
          const d = choice?.delta;
          if (d?.content) yield { type: "text", delta: d.content };
          const r = d?.reasoning_content ?? d?.reasoning;
          if (r) yield { type: "reasoning", delta: r };
          for (const tc of d?.tool_calls ?? []) {
            const acc = toolAcc.get(tc.index) ?? { id: "", name: "", args: "" };
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name += tc.function.name;
            if (tc.function?.arguments) acc.args += tc.function.arguments;
            toolAcc.set(tc.index, acc);
          }
          if (choice?.finish_reason) finish = choice.finish_reason;
          if (chunk.usage) {
            usage = { inputTokens: chunk.usage.prompt_tokens ?? 0, outputTokens: chunk.usage.completion_tokens ?? 0 };
          }
        }
      } catch (err) {
        if (req.signal.aborted) {
          if (usage) yield { type: "usage", ...usage };
          yield { type: "done", stopReason: "aborted" };
          return;
        }
        throw err;
      }

      if (usage) yield { type: "usage", ...usage };
      if (toolAcc.size) {
        if (finish === "length") {
          yield { type: "error", message: "The model's tool call was cut off. Try again.", code: "tool_truncated" };
          yield { type: "done", stopReason: "max_tokens" };
          return;
        }
        for (const [, tc] of [...toolAcc.entries()].sort((a, b) => a[0] - b[0])) {
          let input: unknown;
          try {
            input = tc.args ? JSON.parse(tc.args) : {};
          } catch {
            yield { type: "error", message: `The model produced invalid arguments for ${tc.name}.`, code: "tool_invalid_json" };
            yield { type: "done", stopReason: "error" };
            return;
          }
          yield { type: "tool_call", id: tc.id || `call_${crypto.randomUUID()}`, name: tc.name, input };
        }
        yield { type: "done", stopReason: "tool_use" };
        return;
      }
      yield {
        type: "done",
        stopReason: finish === "length" ? "max_tokens" : finish === "content_filter" ? "refusal" : "end",
      };
    },
  };
}
