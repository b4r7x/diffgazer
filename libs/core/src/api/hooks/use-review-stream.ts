import { useReducer, useRef, useEffect } from "react";
import {
  reviewReducer,
  createInitialReviewState,
  type ReviewState,
  type ReviewAction,
  type ReviewEvent,
  type StreamReviewError,
} from "@diffgazer/core/review";
import { type Result, ok, err } from "@diffgazer/core/result";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { useApi } from "./context.js";

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

  const cancelStream = (reason = "cancel") => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort(reason);
      abortControllerRef.current = null;
    }
  };

  const stop = () => {
    cancelStream("stop");
    dispatch({ type: "COMPLETE" });
  };

  const abort = () => {
    cancelStream("abort");
    dispatch({ type: "RESET" });
  };

  const resume = async (reviewId: string): Promise<Result<void, StreamReviewError>> => {
    cancelStream("resume");

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    dispatch({ type: "START" });
    dispatch({ type: "SET_REVIEW_ID", reviewId });

    const dispatchEvent = (event: ReviewEvent) => dispatch({ type: "EVENT", event });

    try {
      const result = await api.resumeReviewStream({
        reviewId,
        signal: abortController.signal,
        onAgentEvent: dispatchEvent,
        onStepEvent: dispatchEvent,
        onEnrichEvent: dispatchEvent,
      });

      if (abortController.signal.aborted) {
        dispatch({ type: "RESET" });
        return result;
      }

      if (result.ok) {
        dispatch({ type: "COMPLETE" });
        return ok(undefined);
      }

      if (
        result.error.code === ReviewErrorCode.SESSION_STALE ||
        result.error.code === ReviewErrorCode.SESSION_NOT_FOUND
      ) {
        return result;
      }

      dispatch({ type: "ERROR", error: result.error.message });
      return result;
    } catch (e) {
      if (abortController.signal.aborted) {
        dispatch({ type: "RESET" });
        return err({ code: "STREAM_ERROR" as const, message: "aborted" });
      }
      const message = e instanceof Error ? e.message : "Failed to resume";
      dispatch({ type: "ERROR", error: message });
      return err({ code: "STREAM_ERROR" as const, message });
    } finally {
      abortControllerRef.current = null;
    }
  };

  useEffect(() => {
    return () => cancelStream("cleanup");
  }, []);

  return { state, stop, abort, resume };
}
