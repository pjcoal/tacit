import "server-only";
import { providerCostUsd, usageCostCredits } from "@/lib/credits/calc";
import { chatProviderFor } from "@/lib/ai/providers";
import { getChatModel, isChatModelAvailable, resolveAutoModel } from "@/lib/ai/registry";
import { toolsForGroups } from "@/lib/ai/tools";
import { PROVIDER_LABELS, ProviderError, type ChatModelSpec } from "@/lib/ai/types";
import { getRateLimiter } from "@/lib/security/rate-limit";
import { getDb } from "@/server/db/client";
import { env } from "@/server/env";
import { HttpError } from "@/server/http";
import type { ChatStreamEvent, ReasoningLevel, WireMessage } from "@/types/chat";
import { getBalance, recordUsage } from "./ledger";

export interface ChatContext {
  accountId: string | null;
  apiKeyId?: string | null;
  source: "app" | "api";
  /** Day-rotating hashed IP, used for anonymous free quotas. */
  ipKey: string;
  tokenHolder?: boolean;
}

export interface ChatInput {
  modelId: string;
  messages: WireMessage[];
  reasoning?: ReasoningLevel;
  toolGroups?: string[];
  maxTokens?: number;
  temperature?: number;
  /** API callers can supply their own system prompt. */
  extraSystem?: string;
  /** "code" switches to the coding-agent system prompt. */
  mode?: "chat" | "code";
}

export interface PreparedChat {
  model: ChatModelSpec;
  billing: "free" | "credits";
}

const TOKEN_HOLDER_FREE_MULTIPLIER = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

function promptChars(messages: WireMessage[]) {
  return messages.reduce((n, m) => n + (m.content?.length ?? 0), 0);
}

/** Decide model + billing before streaming so errors become proper HTTP statuses. */
export async function prepareChat(ctx: ChatContext, input: ChatInput): Promise<PreparedChat> {
  const e = env();
  const hasImages = input.messages.some((m) => m.role === "user" && (m.images?.length ?? 0) > 0);
  const tools = toolsForGroups(input.toolGroups);

  let balance = 0;
  if (ctx.accountId) balance = await getBalance(await getDb(), ctx.accountId);
  const paying = balance > 0;

  if (ctx.source === "api" && !paying) {
    throw new HttpError(402, "This account has no credits. Buy credits to use the API.", "insufficient_credits");
  }

  let model: ChatModelSpec | undefined;
  if (input.modelId === "auto") {
    model = resolveAutoModel({ promptChars: promptChars(input.messages), hasImages, needsTools: tools.length > 0, freeOnly: !paying });
    if (!model) {
      throw new HttpError(503, paying ? "No model providers are configured." : "No free-tier model is configured. Add credits to use other models.", "no_model_available");
    }
  } else {
    model = getChatModel(input.modelId);
    if (!model) throw new HttpError(400, `Unknown model "${input.modelId}"`, "unknown_model");
    if (!isChatModelAvailable(model)) {
      throw new HttpError(503, `${model.label} is not available: ${PROVIDER_LABELS[model.provider]} is not configured.`, "model_unavailable");
    }
  }
  if (hasImages && !model.vision) throw new HttpError(400, `${model.label} can't read images.`, "vision_unsupported");
  if (tools.length && !model.tools) throw new HttpError(400, `${model.label} doesn't support tools. Pick another model or turn tools off.`, "tools_unsupported");

  if (paying) return { model, billing: "credits" };

  if (!model.free) {
    throw new HttpError(402, `${model.label} needs credits. Free usage covers models marked "free".`, "insufficient_credits");
  }
  // Only a new user turn consumes free quota; tool-result continuations ride on it.
  const last = input.messages[input.messages.length - 1];
  if (last?.role === "user") {
    const limit = e.FREE_DAILY_MESSAGES * (ctx.tokenHolder ? TOKEN_HOLDER_FREE_MULTIPLIER : 1);
    const key = ctx.accountId ? `free:acct:${ctx.accountId}` : `free:ip:${ctx.ipKey}`;
    const r = await getRateLimiter().limit(key, limit, DAY_MS);
    if (!r.success) {
      throw new HttpError(429, `You've used today's ${limit} free messages. Add credits to keep going.`, "free_quota_exhausted");
    }
  }
  return { model, billing: "free" };
}

const CODE_AGENT_PROMPT = `You are a coding agent that builds small, self-contained web projects (HTML, CSS and vanilla JavaScript) that run in a sandboxed browser preview with no network access and no build step.

Workflow for every request:
1. Start with a short plan (2-5 bullet points).
2. Then output every file you create or change as a fenced code block whose info string is the language followed by file=<path>, for example:
\`\`\`html file=index.html
<!doctype html>...
\`\`\`
3. Always output the complete file contents (never diffs or "..."). Only output files that changed.
4. The entry point must be index.html. Reference other files with relative paths (e.g. ./style.css, ./app.js); they are inlined for the preview.
5. Finish with one or two sentences on what to try next.

Do not use external CDNs, fonts, images or APIs. Keep projects small and readable.`;

export function systemPrompt(opts: { tools: boolean; extra?: string; mode?: "chat" | "code" }): string {
  const e = env();
  if (opts.mode === "code") {
    return [
      `You are ${e.NEXT_PUBLIC_APP_NAME} Code. Today's date is ${new Date().toISOString().slice(0, 10)}.`,
      CODE_AGENT_PROMPT,
      "Some identifiers may appear as placeholders like [PERSON_1]; keep them verbatim.",
    ].join("\n\n");
  }
  const parts = [
    `You are ${e.NEXT_PUBLIC_APP_NAME}, a private AI assistant. Today's date is ${new Date().toISOString().slice(0, 10)}.`,
    "Privacy: user messages may contain placeholders such as [PERSON_1], [CITY_1], [EMAIL_1] or [WALLET_1]. Each stands for a real value that was removed on the user's device before this request was sent. Treat placeholders as opaque names: reuse them verbatim (including the brackets) when you refer to that thing, never guess, reconstruct or ask for the underlying value, and never invent new placeholders.",
    "Never ask for, accept or repeat seed phrases, recovery phrases or private keys.",
    "Format answers in GitHub-flavored Markdown. Use fenced code blocks with a language tag for code.",
  ];
  if (opts.tools) {
    parts.push(
      "Solana tools run in the user's browser against their connected wallet; the wallet itself appears as a placeholder. Read tools return data. The prepare_* tools only create a transaction preview: the user must review it and approve it in their own wallet. Never say a transfer was sent or completed unless a tool result explicitly confirms a signature.",
    );
  }
  if (opts.extra) parts.push(opts.extra);
  return parts.join("\n\n");
}

/**
 * Stream a chat completion as normalized events, then meter it. Usage is
 * recorded as counts only — no prompt or completion text is stored.
 */
export async function* runChat(
  ctx: ChatContext,
  input: ChatInput,
  prepared: PreparedChat,
  signal: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  const e = env();
  const { model, billing } = prepared;
  const tools = toolsForGroups(input.toolGroups);

  yield { type: "meta", model: model.id, modelLabel: model.label, provider: model.provider, billing };

  let inputTokens = 0;
  let outputTokens = 0;
  let produced = false;
  let metered = false;
  async function* meter(): AsyncGenerator<ChatStreamEvent> {
    if (metered) return;
    metered = true;
    const pricing = {
      inputTokens,
      outputTokens,
      inputPerMTokUsd: model.priceIn,
      outputPerMTokUsd: model.priceOut,
      markupBps: e.PRICE_MARKUP_BPS,
      creditsPerUsd: e.CREDITS_PER_USD,
    };
    const cost = providerCostUsd(pricing);
    const credits = billing === "credits" && (produced || inputTokens > 0) ? usageCostCredits(pricing) : 0;
    try {
      await recordUsage(await getDb(), {
        accountId: billing === "credits" ? ctx.accountId : null,
        apiKeyId: ctx.apiKeyId,
        source: ctx.source,
        kind: input.mode === "code" ? "code" : "chat",
        model: model.id,
        provider: model.provider,
        inputTokens,
        outputTokens,
        credits,
        providerCostUsd: cost,
      });
    } catch (err) {
      console.error("[chat] failed to record usage", err);
    }
    yield { type: "usage", inputTokens, outputTokens, credits };
  }
  try {
    for await (const ev of chatProviderFor(model).streamChat({
      model,
      system: systemPrompt({ tools: tools.length > 0, extra: input.extraSystem, mode: input.mode }),
      messages: input.messages,
      reasoning: model.reasoning.length ? (input.reasoning ?? (model.reasoning.includes("medium") ? "medium" : model.reasoning[0])) : "off",
      tools,
      signal,
      maxTokens: input.maxTokens,
      temperature: input.temperature,
    })) {
      if (ev.type === "usage") {
        inputTokens = ev.inputTokens;
        outputTokens = ev.outputTokens;
        continue;
      }
      if (ev.type === "text" || ev.type === "tool_call") produced = true;
      if (ev.type === "done") {
        yield* meter();
      }
      yield ev;
    }
  } catch (err) {
    if (inputTokens || outputTokens) yield* meter();
    if (err instanceof ProviderError) {
      yield { type: "error", message: err.message, code: err.code };
    } else {
      console.error("[chat] provider failure", err);
      yield { type: "error", message: "The model request failed.", code: "provider_error" };
    }
    yield { type: "done", stopReason: "error" };
  }

}
