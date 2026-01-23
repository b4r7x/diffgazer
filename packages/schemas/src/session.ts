import { z } from "zod";

export const MESSAGE_ROLES = ["user", "assistant", "system"] as const;
export const MessageRoleSchema = z.enum(MESSAGE_ROLES);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const SessionMessageSchema = z.object({
  id: z.string().uuid(),
  role: MessageRoleSchema,
  content: z.string(),
  createdAt: z.string().datetime(),
});
export type SessionMessage = z.infer<typeof SessionMessageSchema>;

export const SessionMetadataSchema = z.object({
  id: z.string().uuid(),
  projectPath: z.string(),
  title: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
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
