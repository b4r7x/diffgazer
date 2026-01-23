import { useState, useCallback, useRef } from "react";
import { api } from "../../../lib/api.js";
import { type ChatStreamEvent, type ChatError, ChatStreamEventSchema } from "@repo/schemas/chat";
import { useSSEStream, type SSEStreamError } from "../../../hooks/use-sse-stream.js";
import { createErrorState } from "../../../lib/state-helpers.js";

export type ChatState =
  | { status: "idle" }
  | { status: "loading"; streamContent: string }
  | { status: "error"; error: ChatError };

interface UseChatReturn {
  chatState: ChatState;
  sendMessage: (sessionId: string, message: string) => Promise<void>;
  reset: () => void;
}

export function useChat(): UseChatReturn {
  const [chatState, setChatState] = useState<ChatState>({ status: "idle" });

  // Use a ref to track full content across event callbacks
  const fullContentRef = useRef("");

  const handleEvent = useCallback((event: ChatStreamEvent): boolean => {
    if (event.type === "chunk") {
      fullContentRef.current += event.content;
      setChatState({ status: "loading", streamContent: fullContentRef.current });
      return false; // not terminal
    }
    if (event.type === "complete") {
      setChatState({ status: "idle" });
      return true; // terminal
    }
    if (event.type === "error") {
      setChatState({ status: "error", error: event.error });
      return true; // terminal
    }
    return false;
  }, []);

  const handleError = useCallback((error: SSEStreamError): void => {
    setChatState(createErrorState(error.message));
  }, []);

  // For chat, we want to reset to idle on unexpected end instead of showing error
  const handleUnexpectedEnd = useCallback((): void => {
    setChatState({ status: "idle" });
  }, []);

  const { processStream, resetController, abort } = useSSEStream({
    schema: ChatStreamEventSchema,
    onEvent: handleEvent,
    onError: handleError,
    onUnexpectedEnd: handleUnexpectedEnd,
  });

  const sendMessage = useCallback(async (sessionId: string, message: string) => {
    const controller = resetController();
    fullContentRef.current = "";
    setChatState({ status: "loading", streamContent: "" });

    try {
      const response = await api().request("POST", `/sessions/${sessionId}/chat`, {
        body: { message },
        signal: controller.signal,
      });

      const reader = response.body?.getReader();
      if (!reader) {
        setChatState(createErrorState("No response body"));
        return;
      }

      await processStream(reader);
    } catch (error) {
      // Pre-stream errors (e.g., network failure before getting reader)
      // are not handled by useSSEStream, so we catch them here
      if (!(error instanceof Error && error.name === "AbortError")) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setChatState(createErrorState(errorMessage));
      }
    }
  }, [processStream, resetController]);

  const reset = useCallback(() => {
    abort();
    setChatState({ status: "idle" });
  }, [abort]);

  return { chatState, sendMessage, reset };
}
