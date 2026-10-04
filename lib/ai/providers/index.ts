import "server-only";
import type { ChatModelSpec, ChatProvider } from "../types";
import { anthropicProvider } from "./anthropic";
import { googleProvider } from "./google";
import { createCompatProvider } from "./openai-compatible";

const providers: Record<ChatModelSpec["provider"], ChatProvider> = {
  anthropic: anthropicProvider,
  google: googleProvider,
  openai: createCompatProvider("openai"),
  openrouter: createCompatProvider("openrouter"),
  together: createCompatProvider("together"),
  fireworks: createCompatProvider("fireworks"),
  custom: createCompatProvider("custom"),
};

export function chatProviderFor(model: ChatModelSpec): ChatProvider {
  return providers[model.provider];
}
