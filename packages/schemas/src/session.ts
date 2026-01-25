import { z } from "zod";
import { UuidSchema, createdAtField, timestampFields } from "./errors.js";

export const MESSAGE_ROLES = ["user", "assistant", "system"] as const;
export const MessageRoleSchema = z.enum(MESSAGE_ROLES);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const SessionMessageSchema = z.object({
  id: UuidSchema,
  role: MessageRoleSchema,
  content: z.string(),
  ...createdAtField,
});
export type SessionMessage = z.infer<typeof SessionMessageSchema>;

export const SessionMetadataSchema = z.object({
  id: UuidSchema,
  projectPath: z.string(),
  title: z.string().optional(),
  ...timestampFields,
  messageCount: z.number().int().nonnegative(),
});
export type SessionMetadata = z.infer<typeof SessionMetadataSchema>;

export const SessionSchema = z
  .object({
    metadata: SessionMetadataSchema,
    messages: z.array(SessionMessageSchema),
  })
  .refine(
    (data) => data.metadata.messageCount === data.messages.length,
    { message: "messageCount must match messages.length" }
  );
export type Session = z.infer<typeof SessionSchema>;

export const CreateSessionRequestSchema = z.object({
  projectPath: z.string(),
  title: z.string().optional(),
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

export const AddMessageRequestSchema = z.object({
  role: MessageRoleSchema,
  content: z.string(),
});
export type AddMessageRequest = z.infer<typeof AddMessageRequestSchema>;

export const SESSION_EVENT_TYPES = [
  "NAVIGATE",
  "OPEN_ISSUE",
  "TOGGLE_VIEW",
  "APPLY_PATCH",
  "IGNORE_ISSUE",
  "FILTER_CHANGED",
  "RUN_CREATED",
  "RUN_RESUMED",
  "SETTINGS_CHANGED",
] as const;
export const SessionEventTypeSchema = z.enum(SESSION_EVENT_TYPES);
export type SessionEventType = z.infer<typeof SessionEventTypeSchema>;

export const SessionEventSchema = z.object({
  ts: z.number(),
  type: SessionEventTypeSchema,
  payload: z.unknown(),
});
export type SessionEvent = z.infer<typeof SessionEventSchema>;
