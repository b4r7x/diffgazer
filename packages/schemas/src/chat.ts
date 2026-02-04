import { z } from "zod";
import { createDomainErrorSchema, createStreamEventSchema } from "./errors.js";

const CHAT_SPECIFIC_CODES = ["SESSION_NOT_FOUND", "AI_ERROR", "STREAM_ERROR"] as const;

export const ChatErrorSchema = createDomainErrorSchema(CHAT_SPECIFIC_CODES);
export type ChatError = z.infer<typeof ChatErrorSchema>;

export const ChatStreamEventSchema = createStreamEventSchema(
  { content: z.string(), truncated: z.boolean().optional() },
  ChatErrorSchema
);
export type ChatStreamEvent = z.infer<typeof ChatStreamEventSchema>;
