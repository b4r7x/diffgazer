import { useState, useCallback, useRef } from "react";
import { getErrorMessage, isAbortError } from "@repo/core";
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
  const fullContentRef = useRef("");

  const handleEvent = useCallback((event: ChatStreamEvent): boolean => {
    if (event.type === "chunk") {
      fullContentRef.current += event.content;
      setChatState({ status: "loading", streamContent: fullContentRef.current });
      return false;
    }
    if (event.type === "complete") {
      setChatState({ status: "idle" });
      return true;
    }
    if (event.type === "error") {
      setChatState({ status: "error", error: event.error });
      return true;
    }
    return false;
  }, []);

  const handleError = useCallback((error: SSEStreamError): void => {
    setChatState(createErrorState(error.message));
  }, []);

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
      if (!isAbortError(error)) {
        setChatState(createErrorState(getErrorMessage(error)));
      }
    }
  }, [processStream, resetController]);

  const reset = useCallback(() => {
    abort();
    setChatState({ status: "idle" });
  }, [abort]);

  return { chatState, sendMessage, reset };
}
