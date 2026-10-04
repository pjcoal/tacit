import type { ChatStreamEvent, ReasoningLevel, WireMessage } from "@/types/chat";

export type ProviderId =
  | "anthropic"
  | "openai"
  | "google"
  | "openrouter"
  | "together"
  | "fireworks"
  | "replicate"
  | "custom";

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  openrouter: "OpenRouter",
  together: "Together",
  fireworks: "Fireworks",
  replicate: "Replicate",
  custom: "OpenAI-compatible",
};

export interface ChatModelSpec {
  id: string;
  label: string;
  family: string;
  provider: Exclude<ProviderId, "replicate">;
  /** Model id sent to the provider. */
  upstream: string;
  vision: boolean;
  tools: boolean;
  /** Reasoning levels the UI may offer. Empty = no control. */
  reasoning: ReasoningLevel[];
  /** Available on the free tier (no credits). */
  free: boolean;
  tier: "fast" | "smart";
  /** Provider list price in USD per 1M tokens — review against your provider contract. */
  priceIn: number;
  priceOut: number;
  maxOutput: number;
}

export interface ImageModelSpec {
  id: string;
  label: string;
  provider: "openai" | "together" | "replicate";
  upstream: string;
  /** Provider price per image in USD (approximate list price). */
  unitUsd: number;
  aspectRatios: Array<"1:1" | "3:2" | "2:3" | "16:9" | "9:16">;
  qualities: Array<"low" | "medium" | "high">;
}

export interface VideoModelSpec {
  id: string;
  label: string;
  provider: "replicate";
  upstream: string;
  unitUsdPerSecond: number;
  durations: number[];
  resolutions: string[];
  textToVideo: boolean;
  imageToVideo: boolean;
  /** Maps our normalized request onto the model's Replicate input schema. */
  buildInput: (req: { prompt: string; durationSec: number; resolution: string; imageDataUrl?: string }) => Record<string, unknown>;
}

export interface PublicModel {
  id: string;
  label: string;
  family: string;
  provider: ProviderId;
  providerLabel: string;
  available: boolean;
  unavailableReason: string | null;
  vision: boolean;
  tools: boolean;
  reasoning: ReasoningLevel[];
  free: boolean;
  tier: "fast" | "smart" | "auto";
  /** credits per 1K tokens (input/output), for display */
  creditsPer1kIn?: number;
  creditsPer1kOut?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema with additionalProperties: false */
  inputSchema: Record<string, unknown>;
}

export interface ProviderChatRequest {
  model: ChatModelSpec;
  system: string;
  messages: WireMessage[];
  reasoning: ReasoningLevel;
  tools: ToolDefinition[];
  signal: AbortSignal;
  maxTokens?: number;
  temperature?: number;
}

/** Provider adapters stream normalized events; "meta" and credit accounting are added by the caller. */
export type ProviderEvent = Exclude<ChatStreamEvent, { type: "meta" } | { type: "usage" }> | {
  type: "usage";
  inputTokens: number;
  outputTokens: number;
};

export interface ChatProvider {
  id: ProviderId;
  streamChat(req: ProviderChatRequest): AsyncIterable<ProviderEvent>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public status = 502,
    public code = "provider_error",
  ) {
    super(message);
  }
}
