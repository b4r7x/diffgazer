import { useState, useCallback, useRef } from "react";
import {
  type ReviewResult,
  type ReviewError,
  type ReviewStreamEvent,
  ReviewStreamEventSchema,
} from "@repo/schemas/review";
import { getErrorMessage, isAbortError, truncateToDisplayLength } from "@repo/core";
import { createErrorState } from "../../../lib/state-helpers.js";
import { useSSEStream, type SSEStreamError } from "../../../hooks/use-sse-stream.js";
import { streamReview } from "../api/index.js";

const MAX_DISPLAY_LENGTH = 50_000;

export type ReviewState =
  | { status: "idle" }
  | { status: "loading"; content: string }
  | { status: "success"; data: ReviewResult }
  | { status: "error"; error: ReviewError };

export function useReview() {
  const [state, setState] = useState<ReviewState>({ status: "idle" });
  const streamedContentRef = useRef("");

  const handleEvent = useCallback((event: ReviewStreamEvent): boolean => {
    if (event.type === "chunk") {
      streamedContentRef.current = truncateToDisplayLength(
        streamedContentRef.current,
        event.content,
        MAX_DISPLAY_LENGTH
      );
      setState({ status: "loading", content: streamedContentRef.current });
      return false;
    }
    if (event.type === "complete") {
      setState({ status: "success", data: event.result });
      return true;
    }
    if (event.type === "error") {
      setState({ status: "error", error: event.error });
      return true;
    }
    return false;
  }, []);

  const handleError = useCallback((error: SSEStreamError): void => {
    setState(createErrorState(error.message));
  }, []);

  const { processStream, resetController, abort } = useSSEStream({
    schema: ReviewStreamEventSchema,
    onEvent: handleEvent,
    onError: handleError,
  });

  async function startReview(staged = true): Promise<void> {
    const controller = resetController();
    streamedContentRef.current = "";
    setState({ status: "loading", content: "" });

    try {
      const res = await streamReview({ staged, signal: controller.signal });

      const reader = res.body?.getReader();
      if (!reader) {
        setState(createErrorState("No response body"));
        return;
      }

      await processStream(reader);
    } catch (error) {
      if (!isAbortError(error)) {
        setState(createErrorState(getErrorMessage(error)));
      }
    }
  }

  function reset(): void {
    abort();
    setState({ status: "idle" });
  }

  return { state, startReview, reset };
}
