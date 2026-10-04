import "server-only";
import { z } from "zod";
import { IMAGE_MIME_TYPES, LIMITS, validateImageBase64 } from "@/lib/security/uploads";

const wireImage = z
  .object({ mime: z.enum(IMAGE_MIME_TYPES), data: z.string().min(16) })
  .superRefine((img, ctx) => {
    try {
      validateImageBase64(img.mime, img.data);
    } catch (e) {
      ctx.addIssue({ code: "custom", message: (e as Error).message });
    }
  });

const toolCall = z.object({ id: z.string().min(1).max(128), name: z.string().min(1).max(64), input: z.unknown() });

export const wireMessageSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("user"),
    content: z.string().max(LIMITS.maxMessageChars),
    images: z.array(wireImage).max(LIMITS.maxImagesPerMessage).optional(),
  }),
  z.object({
    role: z.literal("assistant"),
    content: z.string().max(LIMITS.maxMessageChars),
    toolCalls: z.array(toolCall).max(16).optional(),
    providerState: z.unknown().optional(),
  }),
  z.object({
    role: z.literal("tool"),
    toolCallId: z.string().min(1).max(128),
    name: z.string().min(1).max(64),
    content: z.string().max(100_000),
    isError: z.boolean().optional(),
  }),
]);

export const chatRequestSchema = z.object({
  model: z.string().min(1).max(64),
  messages: z.array(wireMessageSchema).min(1).max(LIMITS.maxMessages),
  reasoning: z.enum(["off", "low", "medium", "high"]).optional(),
  tools: z.array(z.enum(["solana"])).max(4).optional(),
  privacyMode: z.enum(["smart", "strict", "off"]),
  mode: z.enum(["chat", "code"]).optional(),
  agent: z
    .object({
      name: z.string().trim().min(1).max(80),
      instructions: z.string().max(LIMITS.maxAgentInstructions),
    })
    .optional(),
});
