import type { ChatRequestBody, ChatStreamEvent, ReasoningLevel, WireImage, WireMessage } from "@/types/chat";
import { sanitizePrompt } from "./sanitize";
import type { PlaceholderMap, PrivacyMode, SanitizeResult } from "./types";

/** Read an NDJSON response body as a stream of chat events. */
export async function* readEventStream(res: Response): AsyncGenerator<ChatStreamEvent> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) yield JSON.parse(line) as ChatStreamEvent;
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer) as ChatStreamEvent;
}

export interface SendOptions {
  /** Prior turns, exactly as previously sent (user text already sanitized, assistant text as the model wrote it). */
  history: WireMessage[];
  /** The new user message as typed. Omit when continuing after tool results. */
  userText?: string;
  images?: WireImage[];
  mode: PrivacyMode;
  map: PlaceholderMap;
  model: string;
  reasoning?: ReasoningLevel;
  tools?: string[];
  signal?: AbortSignal;
  endpoint?: string;
  chatMode?: "chat" | "code";
}

export interface SendResult {
  /** What the user typed vs. what left the browser (the privacy receipt). */
  receipt: SanitizeResult | null;
  /** Updated conversation map (persist it locally). */
  map: PlaceholderMap;
  /** The user message as sent, to append to local history. */
  sentMessage: WireMessage | null;
  events: AsyncGenerator<ChatStreamEvent>;
}

/**
 * Sanitize the new user message in the browser, then send only the sanitized
 * conversation to the server. The placeholder map never leaves the device.
 */
export async function sendSanitizedPrompt(opts: SendOptions): Promise<SendResult> {
  let receipt: SanitizeResult | null = null;
  let map = opts.map;
  let sentMessage: WireMessage | null = null;
  const messages = [...opts.history];

  if (opts.userText !== undefined) {
    receipt = sanitizePrompt(opts.userText, opts.mode, map);
    map = receipt.map;
    sentMessage = { role: "user", content: receipt.sanitized, ...(opts.images?.length ? { images: opts.images } : {}) };
    messages.push(sentMessage);
  }

  const body: ChatRequestBody = {
    model: opts.model,
    messages,
    reasoning: opts.reasoning,
    tools: opts.tools,
    privacyMode: opts.mode,
    ...(opts.chatMode ? { mode: opts.chatMode } : {}),
  };

  const res = await fetch(opts.endpoint ?? "/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: opts.signal,
    credentials: "same-origin",
  });

  async function* events(): AsyncGenerator<ChatStreamEvent> {
    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      let code: string | undefined;
      try {
        const j = await res.json();
        message = j.error ?? message;
        code = j.code;
      } catch {}
      yield { type: "error", message, code };
      return;
    }
    yield* readEventStream(res);
  }

  return { receipt, map, sentMessage, events: events() };
}
