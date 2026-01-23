import type { AIClient, StreamCallbacks } from "@repo/core/ai";
import type { Session } from "@repo/schemas/session";
import { addMessage, sessionStore, configStore } from "@repo/core/storage";
import { createAIClient } from "@repo/core/ai";
import { getApiKey } from "@repo/core/secrets";
import { ErrorCode, type ErrorCode as ErrorCodeType } from "@repo/schemas/errors";
import type { Result } from "@repo/core";
import { ok, err, getErrorMessage } from "@repo/core";

// ============================================================================
// Types
// ============================================================================

export interface ChatError {
  message: string;
  code: typeof ErrorCode.SESSION_NOT_FOUND | typeof ErrorCode.CONFIG_NOT_FOUND | typeof ErrorCode.API_KEY_MISSING | typeof ErrorCode.AI_CLIENT_ERROR | typeof ErrorCode.MESSAGE_SAVE_ERROR;
}

export interface SSEWriter {
  writeSSE: (data: { event: string; data: string }) => Promise<void>;
}

export interface ChatContext {
  session: Session;
  aiClient: AIClient;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Builds conversation history from session messages.
 */
function buildConversationHistory(session: Session): string {
  return session.messages
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join("\n\n");
}

/**
 * Builds the chat prompt with conversation context.
 */
function buildChatPrompt(conversationHistory: string, userMessage: string): string {
  return `You are a helpful AI assistant for code review and development discussions.

Previous conversation:
${conversationHistory}

USER: ${userMessage}

Respond helpfully and concisely.`;
}

/**
 * Loads session and validates it exists.
 */
async function loadSession(sessionId: string): Promise<Result<Session, ChatError>> {
  const sessionResult = await sessionStore.read(sessionId);
  if (!sessionResult.ok) {
    return err({ message: "Session not found", code: ErrorCode.SESSION_NOT_FOUND });
  }
  return ok(sessionResult.value);
}

/**
 * Initializes the AI client from stored configuration.
 */
async function initializeAIClient(): Promise<Result<AIClient, ChatError>> {
  const configResult = await configStore.read();
  if (!configResult.ok) {
    return err({ message: "AI provider not configured", code: ErrorCode.CONFIG_NOT_FOUND });
  }

  const apiKeyResult = await getApiKey(configResult.value.provider);
  if (!apiKeyResult.ok) {
    return err({ message: "API key not found", code: ErrorCode.API_KEY_MISSING });
  }

  const clientResult = createAIClient({
    apiKey: apiKeyResult.value,
    model: configResult.value.model,
  });
  if (!clientResult.ok) {
    return err({ message: clientResult.error.message, code: ErrorCode.AI_CLIENT_ERROR });
  }

  return ok(clientResult.value);
}

// ============================================================================
// Main Service Functions
// ============================================================================

/**
 * Prepares the chat context by loading session and initializing AI client.
 * Call this before streaming to validate everything is ready.
 */
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

/**
 * Saves a user message to the session.
 */
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

/**
 * Streams a chat response to an SSE writer.
 * Handles prompt construction, streaming, response persistence, and SSE formatting.
 */
export async function streamChatToSSE(
  sessionId: string,
  userMessage: string,
  context: ChatContext,
  stream: SSEWriter
): Promise<void> {
  const conversationHistory = buildConversationHistory(context.session);
  const prompt = buildChatPrompt(conversationHistory, userMessage);

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
