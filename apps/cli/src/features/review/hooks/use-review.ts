import { useState, useCallback, useRef } from "react";
import {
  type ReviewResult,
  type ReviewError,
  type ReviewStreamEvent,
  ReviewStreamEventSchema,
} from "@repo/schemas/review";
import { getErrorMessage } from "@repo/core";
import { api } from "../../../lib/api.js";
import { truncateToDisplayLength } from "../../../lib/string-utils.js";
import { useSSEStream, type SSEStreamError } from "../../../hooks/use-sse-stream.js";

/** Maximum characters to keep in the display buffer for UI rendering. */
const MAX_DISPLAY_LENGTH = 50_000;

export type ReviewState =
  | { status: "idle" }
  | { status: "loading"; content: string }
  | { status: "success"; data: ReviewResult }
  | { status: "error"; error: ReviewError };

/** Helper to create a properly typed error state for ReviewState */
function createReviewErrorState(message: string): ReviewState {
  return { status: "error", error: { message, code: "INTERNAL_ERROR" } };
}

export function useReview() {
  const [state, setState] = useState<ReviewState>({ status: "idle" });

  // Use a ref to track streamed content across event callbacks
  const streamedContentRef = useRef("");

  const handleEvent = useCallback((event: ReviewStreamEvent): boolean => {
    if (event.type === "chunk") {
      streamedContentRef.current = truncateToDisplayLength(
        streamedContentRef.current,
        event.content,
        MAX_DISPLAY_LENGTH
      );
      setState({ status: "loading", content: streamedContentRef.current });
      return false; // not terminal
    }
    if (event.type === "complete") {
      setState({ status: "success", data: event.result });
      return true; // terminal
    }
    if (event.type === "error") {
      setState({ status: "error", error: event.error });
      return true; // terminal
    }
    return false;
  }, []);

  const handleError = useCallback((error: SSEStreamError): void => {
    setState(createReviewErrorState(error.message));
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
      const res = await api().stream("/review/stream", {
        params: { staged: String(staged) },
        signal: controller.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) {
        setState(createReviewErrorState("No response body"));
        return;
      }

      await processStream(reader);
    } catch (error) {
      // Pre-stream errors (e.g., network failure before getting reader)
      // are not handled by useSSEStream, so we catch them here
      if (!(error instanceof Error && error.name === "AbortError")) {
        setState(createReviewErrorState(getErrorMessage(error)));
      }
    }
  }

  function reset(): void {
    abort();
    setState({ status: "idle" });
  }

  return { state, startReview, reset };
}
