import type { AIClient } from "../../shared/lib/ai/types.js";
import type { Session } from "@stargazer/schemas/session";
import { addMessage, sessionStore } from "./store.js";
import { ErrorCode } from "@stargazer/schemas/errors";
import { type Result, ok, err } from "@stargazer/core";
import { getErrorMessage } from "@stargazer/core";
import { escapeXml, sanitizeUnicode } from "../../shared/utils/sanitization.js";
import { initializeAIClient, type SSEWriter } from "../../shared/lib/ai/client.js";
import { writeSSEChunk, writeSSEComplete, writeSSEError } from "../../shared/lib/http/sse.js";
import { type ChatError } from "@stargazer/schemas/chat";

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

  const clientResult = initializeAIClient();
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
  // CVE-2025-53773: Escape user content to prevent prompt injection
  const sanitizedMessage = escapeXml(sanitizeUnicode(userMessage));
  const conversationHistory = context.session.messages
    .map((msg) => `${msg.role.toUpperCase()}: ${escapeXml(sanitizeUnicode(msg.content))}`)
    .join("\n\n");

  const prompt = `You are a helpful AI assistant for code review and development discussions.

Previous conversation:
${conversationHistory}

USER: ${sanitizedMessage}

Respond helpfully and concisely.`;

  try {
    await context.aiClient.generateStream(prompt, {
      onChunk: async (chunk) => {
        await writeSSEChunk(stream, chunk);
      },
      onComplete: async (content, metadata) => {
        await addMessage(sessionId, "assistant", content);
        await writeSSEComplete(stream, { content, truncated: metadata.truncated });
      },
      onError: async (error) => {
        await writeSSEError(stream, error.message, ErrorCode.AI_ERROR);
      },
    });
  } catch (error) {
    try {
      await writeSSEError(stream, getErrorMessage(error), ErrorCode.STREAM_ERROR);
    } catch {
      // Stream already closed, cannot send error - will be handled by route-level catch
      throw error;
    }
  }
}
