import type { PrivacyMode } from "@/lib/privacy/types";

export type ReasoningLevel = "off" | "low" | "medium" | "high";

export interface WireImage {
  mime: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  /** base64, no data: prefix */
  data: string;
}

export interface WireToolCall {
  id: string;
  name: string;
  input: unknown;
}

/** Messages as they travel to the server: user text is already sanitized in the browser. */
export type WireMessage =
  | { role: "user"; content: string; images?: WireImage[] }
  | { role: "assistant"; content: string; toolCalls?: WireToolCall[]; providerState?: unknown }
  | { role: "tool"; toolCallId: string; name: string; content: string; isError?: boolean };

export interface ChatRequestBody {
  model: string;
  messages: WireMessage[];
  reasoning?: ReasoningLevel;
  tools?: string[];
  privacyMode: PrivacyMode;
  /** "code" selects the coding-agent system prompt. */
  mode?: "chat" | "code";
  /** A user-defined agent. Sanitized in the browser like any message. */
  agent?: AgentPayload;
}

export interface AgentPayload {
  name: string;
  instructions: string;
}

export type StopReason = "end" | "tool_use" | "max_tokens" | "refusal" | "aborted" | "error";

export type ChatStreamEvent =
  | { type: "meta"; model: string; modelLabel: string; provider: string; billing: "free" | "credits" }
  | { type: "text"; delta: string }
  | { type: "reasoning"; delta: string }
  | { type: "tool_call"; id: string; name: string; input: unknown }
  | { type: "provider_state"; state: unknown }
  | { type: "usage"; inputTokens: number; outputTokens: number; credits: number }
  | { type: "done"; stopReason: StopReason }
  | { type: "error"; message: string; code?: string };
