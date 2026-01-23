import { z } from "zod";
import { SHARED_ERROR_CODES, type SharedErrorCode } from "./errors.js";

/** Chat-specific error codes (domain-specific) */
export const CHAT_SPECIFIC_CODES = ["SESSION_NOT_FOUND", "AI_ERROR", "STREAM_ERROR"] as const;
export type ChatSpecificCode = (typeof CHAT_SPECIFIC_CODES)[number];

/** All chat error codes: shared + domain-specific */
export const CHAT_ERROR_CODES = [...SHARED_ERROR_CODES, ...CHAT_SPECIFIC_CODES] as const;
export const ChatErrorCodeSchema = z.enum(CHAT_ERROR_CODES);
export type ChatErrorCode = SharedErrorCode | ChatSpecificCode;

export const ChatErrorSchema = z.object({
  message: z.string(),
  code: ChatErrorCodeSchema,
});
export type ChatError = z.infer<typeof ChatErrorSchema>;

export const ChatStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("chunk"), content: z.string() }),
  z.object({
    type: z.literal("complete"),
    content: z.string(),
    truncated: z.boolean().optional()
  }),
  z.object({ type: z.literal("error"), error: ChatErrorSchema }),
]);
export type ChatStreamEvent = z.infer<typeof ChatStreamEventSchema>;
