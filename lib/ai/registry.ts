import "server-only";
import { z } from "zod";
import { env } from "@/server/env";
import type { ReasoningLevel } from "@/types/chat";
import {
  PROVIDER_LABELS,
  type ChatModelSpec,
  type ImageModelSpec,
  type ProviderId,
  type PublicModel,
  type VideoModelSpec,
} from "./types";

/**
 * Built-in catalogue. A model is only offered when its provider key is
 * configured; otherwise it is listed as unavailable — never silently mocked.
 * Prices are provider list prices used for credit metering; operators should
 * review them (and can override any entry through CUSTOM_MODELS).
 */
const ALL: ReasoningLevel[] = ["off", "low", "medium", "high"];

const BUILT_IN_CHAT: ChatModelSpec[] = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", family: "Claude", provider: "anthropic", upstream: "claude-opus-5-5", vision: true, tools: true, reasoning: ["low", "medium", "high"], free: false, tier: "smart", priceIn: 4, priceOut: 20, maxOutput: 32_000 },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", family: "Claude", provider: "anthropic", upstream: "claude-sonnet-5-5", vision: true, tools: true, reasoning: ALL, free: false, tier: "smart", priceIn: 2, priceOut: 10, maxOutput: 32_000 },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", family: "Claude", provider: "anthropic", upstream: "claude-haiku-4-5", vision: true, tools: true, reasoning: ALL, free: true, tier: "fast", priceIn: 1, priceOut: 5, maxOutput: 16_000 },
  { id: "gpt-5", label: "GPT-5", family: "GPT", provider: "openai", upstream: "gpt-5", vision: true, tools: true, reasoning: ["low", "medium", "high"], free: false, tier: "smart", priceIn: 1.25, priceOut: 10, maxOutput: 32_000 },
  { id: "gpt-5-mini", label: "GPT-5 mini", family: "GPT", provider: "openai", upstream: "gpt-5-mini", vision: true, tools: true, reasoning: ["low", "medium", "high"], free: true, tier: "fast", priceIn: 0.25, priceOut: 2, maxOutput: 16_000 },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", family: "Gemini", provider: "google", upstream: "gemini-2.5-pro", vision: true, tools: false, reasoning: ["low", "medium", "high"], free: false, tier: "smart", priceIn: 1.25, priceOut: 10, maxOutput: 32_000 },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", family: "Gemini", provider: "google", upstream: "gemini-2.5-flash", vision: true, tools: false, reasoning: ALL, free: true, tier: "fast", priceIn: 0.3, priceOut: 2.5, maxOutput: 16_000 },
  { id: "deepseek-v3", label: "DeepSeek V3", family: "DeepSeek", provider: "openrouter", upstream: "deepseek/deepseek-chat", vision: false, tools: true, reasoning: [], free: true, tier: "fast", priceIn: 0.3, priceOut: 0.9, maxOutput: 8_000 },
  { id: "deepseek-r1", label: "DeepSeek R1", family: "DeepSeek", provider: "openrouter", upstream: "deepseek/deepseek-r1", vision: false, tools: false, reasoning: [], free: false, tier: "smart", priceIn: 0.55, priceOut: 2.2, maxOutput: 16_000 },
  { id: "qwen3-235b", label: "Qwen3 235B", family: "Qwen", provider: "openrouter", upstream: "qwen/qwen3-235b-a22b", vision: false, tools: true, reasoning: [], free: true, tier: "fast", priceIn: 0.2, priceOut: 0.6, maxOutput: 8_000 },
  { id: "kimi-k2", label: "Kimi K2", family: "Kimi", provider: "openrouter", upstream: "moonshotai/kimi-k2", vision: false, tools: true, reasoning: [], free: false, tier: "smart", priceIn: 0.6, priceOut: 2.5, maxOutput: 8_000 },
  { id: "llama-3.3-70b", label: "Llama 3.3 70B", family: "Llama", provider: "openrouter", upstream: "meta-llama/llama-3.3-70b-instruct", vision: false, tools: true, reasoning: [], free: true, tier: "fast", priceIn: 0.13, priceOut: 0.4, maxOutput: 8_000 },
];

export const IMAGE_MODELS: ImageModelSpec[] = [
  { id: "gpt-image-1", label: "GPT Image", provider: "openai", upstream: "gpt-image-1", unitUsd: 0.07, aspectRatios: ["1:1", "3:2", "2:3"], qualities: ["low", "medium", "high"] },
  { id: "flux-schnell", label: "FLUX.1 schnell", provider: "together", upstream: "black-forest-labs/FLUX.1-schnell", unitUsd: 0.003, aspectRatios: ["1:1", "3:2", "2:3", "16:9", "9:16"], qualities: [] },
  { id: "flux-1.1-pro", label: "FLUX 1.1 Pro", provider: "replicate", upstream: "black-forest-labs/flux-1.1-pro", unitUsd: 0.04, aspectRatios: ["1:1", "3:2", "2:3", "16:9", "9:16"], qualities: [] },
];

export const VIDEO_MODELS: VideoModelSpec[] = [
  {
    id: "hailuo-02",
    label: "Hailuo 02",
    provider: "replicate",
    upstream: "minimax/hailuo-02",
    unitUsdPerSecond: 0.045,
    durations: [6, 10],
    resolutions: ["768p", "1080p"],
    textToVideo: true,
    imageToVideo: true,
    buildInput: ({ prompt, durationSec, resolution, imageDataUrl }) => ({
      prompt,
      duration: durationSec,
      resolution,
      ...(imageDataUrl ? { first_frame_image: imageDataUrl } : {}),
    }),
  },
  {
    id: "veo-3-fast",
    label: "Veo 3 Fast",
    provider: "replicate",
    upstream: "google/veo-3-fast",
    unitUsdPerSecond: 0.25,
    durations: [8],
    resolutions: ["720p", "1080p"],
    textToVideo: true,
    imageToVideo: true,
    buildInput: ({ prompt, resolution, imageDataUrl }) => ({
      prompt,
      resolution,
      ...(imageDataUrl ? { image: imageDataUrl } : {}),
    }),
  },
];

const customModelSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,63}$/),
  label: z.string().min(1).max(64),
  family: z.string().min(1).max(32).default("Custom"),
  provider: z.enum(["anthropic", "openai", "google", "openrouter", "together", "fireworks", "custom"]),
  upstream: z.string().min(1).max(200),
  vision: z.boolean().default(false),
  tools: z.boolean().default(false),
  reasoning: z.array(z.enum(["off", "low", "medium", "high"])).default([]),
  free: z.boolean().default(false),
  tier: z.enum(["fast", "smart"]).default("smart"),
  priceIn: z.number().nonnegative(),
  priceOut: z.number().nonnegative(),
  maxOutput: z.number().int().positive().max(128_000).default(8_000),
});

let customCache: { raw: string | undefined; models: ChatModelSpec[] } | null = null;

function customModels(): ChatModelSpec[] {
  const raw = env().CUSTOM_MODELS;
  if (customCache && customCache.raw === raw) return customCache.models;
  let models: ChatModelSpec[] = [];
  if (raw) {
    try {
      models = z.array(customModelSchema).parse(JSON.parse(raw));
    } catch (err) {
      console.error("[models] CUSTOM_MODELS is invalid and was ignored:", (err as Error).message);
    }
  }
  customCache = { raw, models };
  return models;
}

export function providerConfigured(provider: ProviderId): boolean {
  const e = env();
  switch (provider) {
    case "anthropic":
      return Boolean(e.ANTHROPIC_API_KEY);
    case "openai":
      return Boolean(e.OPENAI_API_KEY);
    case "google":
      return Boolean(e.GOOGLE_API_KEY);
    case "openrouter":
      return Boolean(e.OPENROUTER_API_KEY);
    case "together":
      return Boolean(e.TOGETHER_API_KEY);
    case "fireworks":
      return Boolean(e.FIREWORKS_API_KEY);
    case "replicate":
      return Boolean(e.REPLICATE_API_TOKEN);
    case "custom":
      return Boolean(e.OPENAI_COMPATIBLE_BASE_URL && e.OPENAI_COMPATIBLE_API_KEY);
  }
}

export function chatModels(): ChatModelSpec[] {
  const disabled = new Set(env().DISABLED_MODELS);
  const byId = new Map<string, ChatModelSpec>();
  for (const m of BUILT_IN_CHAT) byId.set(m.id, m);
  for (const m of customModels()) byId.set(m.id, m); // custom entries override built-ins
  return [...byId.values()].filter((m) => !disabled.has(m.id));
}

export function getChatModel(id: string): ChatModelSpec | undefined {
  return chatModels().find((m) => m.id === id);
}

export function isChatModelAvailable(m: ChatModelSpec): boolean {
  return providerConfigured(m.provider);
}

/**
 * "Auto" picks a configured model: the fast tier for short prompts, the smart
 * tier for long or code-heavy ones, a vision model when images are attached.
 */
export function resolveAutoModel(opts: { promptChars: number; hasImages: boolean; needsTools: boolean; freeOnly: boolean }): ChatModelSpec | undefined {
  const pool = chatModels().filter(
    (m) =>
      isChatModelAvailable(m) &&
      (!opts.freeOnly || m.free) &&
      (!opts.hasImages || m.vision) &&
      (!opts.needsTools || m.tools),
  );
  const wantSmart = opts.promptChars > 1200 || opts.hasImages;
  const preferred = pool.filter((m) => m.tier === (wantSmart ? "smart" : "fast"));
  return preferred[0] ?? pool[0];
}

export function publicChatModels(creditsPerUsd: number, markupBps: number): PublicModel[] {
  const per1k = (usdPerM: number) => Math.round(((usdPerM / 1000) * (1 + markupBps / 10_000) * creditsPerUsd) * 1000) / 1000;
  const models: PublicModel[] = chatModels().map((m) => {
    const available = isChatModelAvailable(m);
    return {
      id: m.id,
      label: m.label,
      family: m.family,
      provider: m.provider,
      providerLabel: PROVIDER_LABELS[m.provider],
      available,
      unavailableReason: available ? null : `${PROVIDER_LABELS[m.provider]} not configured`,
      vision: m.vision,
      tools: m.tools,
      reasoning: m.reasoning,
      free: m.free,
      tier: m.tier,
      creditsPer1kIn: per1k(m.priceIn),
      creditsPer1kOut: per1k(m.priceOut),
    };
  });
  const anyAvailable = models.some((m) => m.available);
  return [
    {
      id: "auto",
      label: "Auto",
      family: "Auto",
      provider: "custom",
      providerLabel: "Router",
      available: anyAvailable,
      unavailableReason: anyAvailable ? null : "No model providers configured",
      vision: models.some((m) => m.available && m.vision),
      tools: models.some((m) => m.available && m.tools),
      reasoning: [],
      free: models.some((m) => m.available && m.free),
      tier: "auto",
    },
    ...models,
  ];
}

export function publicImageModels() {
  return IMAGE_MODELS.map((m) => ({
    id: m.id,
    label: m.label,
    provider: m.provider,
    providerLabel: PROVIDER_LABELS[m.provider],
    available: providerConfigured(m.provider),
    aspectRatios: m.aspectRatios,
    qualities: m.qualities,
    unitUsd: m.unitUsd,
  }));
}

export function publicVideoModels() {
  return VIDEO_MODELS.map((m) => ({
    id: m.id,
    label: m.label,
    provider: m.provider,
    providerLabel: PROVIDER_LABELS[m.provider],
    available: providerConfigured(m.provider),
    durations: m.durations,
    resolutions: m.resolutions,
    textToVideo: m.textToVideo,
    imageToVideo: m.imageToVideo,
    unitUsdPerSecond: m.unitUsdPerSecond,
  }));
}
