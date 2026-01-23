import type { AIClient } from "@repo/core/ai";
import type { Session } from "@repo/schemas/session";
import { addMessage, sessionStore } from "@repo/core/storage";
import { ErrorCode } from "@repo/schemas/errors";
import type { Result } from "@repo/core";
import { ok, err, getErrorMessage } from "@repo/core";
import { initializeAIClient, type SSEWriter } from "../lib/ai-client.js";
import { type ChatError } from "@repo/schemas/chat";

export type { SSEWriter };
export type { ChatError };

export interface ChatContext {
  session: Session;
  aiClient: AIClient;
}

async function loadSession(sessionId: string): Promise<Result<Session, ChatError>> {
  const sessionResult = await sessionStore.read(sessionId);
  if (!sessionResult.ok) {
    return err({ message: "Session not found", code: ErrorCode.SESSION_NOT_FOUND });
  }
  return ok(sessionResult.value);
}

export async function prepareChatContext(sessionId: string): Promise<Result<ChatContext, ChatError>> {
  const sessionResult = await loadSession(sessionId);
  if (!sessionResult.ok) return sessionResult;

  const clientResult = await initializeAIClient();
  if (!clientResult.ok) return clientResult;

  return ok({
    session: sessionResult.value,
    aiClient: clientResult.value,
  });
}

export async function saveUserMessage(
  sessionId: string,
  message: string
): Promise<Result<void, ChatError>> {
  const result = await addMessage(sessionId, "user", message);
  if (!result.ok) {
    return err({ message: "Failed to save message", code: ErrorCode.MESSAGE_SAVE_ERROR });
  }
  return ok(undefined);
}

export async function streamChatToSSE(
  sessionId: string,
  userMessage: string,
  context: ChatContext,
  stream: SSEWriter
): Promise<void> {
  const conversationHistory = context.session.messages
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join("\n\n");

  const prompt = `You are a helpful AI assistant for code review and development discussions.

Previous conversation:
${conversationHistory}

USER: ${userMessage}

Respond helpfully and concisely.`;

  try {
    await context.aiClient.generateStream(prompt, {
      onChunk: async (chunk) => {
        await stream.writeSSE({
          event: "chunk",
          data: JSON.stringify({ type: "chunk", content: chunk }),
        });
      },
      onComplete: async (content, metadata) => {
        await addMessage(sessionId, "assistant", content);
        await stream.writeSSE({
          event: "complete",
          data: JSON.stringify({ type: "complete", content, truncated: metadata.truncated }),
        });
      },
      onError: async (error) => {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ type: "error", error: { message: error.message, code: ErrorCode.AI_ERROR } }),
        });
      },
    });
  } catch (error) {
    await stream.writeSSE({
      event: "error",
      data: JSON.stringify({ type: "error", error: { message: getErrorMessage(error), code: ErrorCode.STREAM_ERROR } }),
    });
  }
}
