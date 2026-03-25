import { useReducer, useRef, useEffect } from "react";
import type { AgentStreamEvent, EnrichEvent, StepEvent } from "@diffgazer/schemas/events";
import {
  reviewReducer,
  createInitialReviewState,
  type ReviewState,
  type ReviewAction,
  type StreamReviewError,
} from "@diffgazer/core/review";
import { type Result, ok } from "@diffgazer/core/result";
import { ReviewErrorCode, type ReviewMode, type LensId } from "@diffgazer/schemas/review";
import type { StreamReviewError } from "../review.js";
import { useApi } from "./context.js";

type ReviewEvent = AgentStreamEvent | StepEvent | EnrichEvent;

export interface ReviewStreamState extends ReviewState {
  reviewId: string | null;
}

type StreamAction =
  | ReviewAction
  | { type: "SET_REVIEW_ID"; reviewId: string };

function createInitialStreamState(): ReviewStreamState {
  return {
    ...createInitialReviewState(),
    reviewId: null,
  };
}

function streamReducer(state: ReviewStreamState, action: StreamAction): ReviewStreamState {
  switch (action.type) {
    case "SET_REVIEW_ID":
      return { ...state, reviewId: action.reviewId };
    case "START":
    case "RESET":
      return { ...reviewReducer(state, action), reviewId: null };
  }

  if (action.type === "EVENT" && action.event.type === "review_started") {
    const newState = reviewReducer(state, action);
    return { ...newState, reviewId: action.event.reviewId };
  }

  const next = reviewReducer(state, action);
  return next === state ? state : { ...next, reviewId: state.reviewId };
}

export function useReviewStream() {
  const api = useApi();
  const [state, dispatch] = useReducer(streamReducer, createInitialStreamState());
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStreamError = (error: unknown) => {
    if (error instanceof Error && error.name === "AbortError") {
      dispatch({ type: "COMPLETE" });
    } else {
      const message = error instanceof Error ? error.message : "Failed to stream";
      dispatch({ type: "ERROR", error: message });
    }
  };

  const dispatchEvent = (event: ReviewEvent) => {
    dispatch({ type: "EVENT", event });
  };

  const cancelStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const stop = () => {
    cancelStream();
    dispatch({ type: "COMPLETE" });
  };

  const abort = () => {
    cancelStream();
    dispatch({ type: "RESET" });
  };

  const start = async (mode: ReviewMode, lenses?: LensId[]) => {
    cancelStream();

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    dispatch({ type: "START" });

    try {
      const result = await api.streamReviewWithEvents({
        mode,
        lenses,
        signal: abortController.signal,
        onAgentEvent: dispatchEvent,
        onStepEvent: dispatchEvent,
        onEnrichEvent: dispatchEvent,
      });

      if (!result.ok) {
        dispatch({ type: "ERROR", error: result.error.message });
      } else {
        dispatch({ type: "SET_REVIEW_ID", reviewId: result.value.reviewId });
        dispatch({ type: "COMPLETE" });
      }
    } catch (e) {
      handleStreamError(e);
    } finally {
      abortControllerRef.current = null;
    }
  };

  const resume = async (reviewId: string): Promise<Result<void, StreamReviewError>> => {
    cancelStream();

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    dispatch({ type: "START" });

    try {
      const result = await api.resumeReviewStream({
        reviewId,
        signal: abortController.signal,
        onAgentEvent: dispatchEvent,
        onStepEvent: dispatchEvent,
        onEnrichEvent: dispatchEvent,
      });

      if (result.ok) {
        dispatch({ type: "COMPLETE" });
        return ok(undefined);
      }

      // Stale/not-found: let the caller decide (don't dispatch RESET or ERROR)
      if (
        result.error.code === ReviewErrorCode.SESSION_STALE ||
        result.error.code === ReviewErrorCode.SESSION_NOT_FOUND
      ) {
        return result;
      }

      // Other errors: dispatch ERROR and return the result
      dispatch({ type: "ERROR", error: result.error.message });
      return result;
    } catch (e) {
      handleStreamError(e);
      return { ok: false, error: { code: "STREAM_ERROR" as const, message: e instanceof Error ? e.message : "Failed to resume" } };
    } finally {
      abortControllerRef.current = null;
    }
  };

  useEffect(() => {
    return () => cancelStream();
  }, []);

  return { state, start, stop, abort, resume };
}
