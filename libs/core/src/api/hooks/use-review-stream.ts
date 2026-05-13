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
import { ReviewErrorCode, type ReviewMode, type LensId } from "@diffgazer/core/schemas/review";
import { useApi } from "./context.js";

export interface ReviewStreamState extends ReviewState {
  reviewId: string | null;
}

type StreamAction =
  | ReviewAction
  | { type: "SET_REVIEW_ID"; reviewId: string };

function logReviewStream(event: string, data: Record<string, unknown> = {}) {
  console.log(`[diffgazer:review-stream] ${event}`, {
    at: new Date().toISOString(),
    ...data,
  });
}

function warnReviewStream(event: string, data: Record<string, unknown> = {}) {
  console.warn(`[diffgazer:review-stream] ${event}`, {
    at: new Date().toISOString(),
    ...data,
  });
}

function describeStreamError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { value: error };
}

function getDebugStack() {
  return new Error("review stream stack").stack;
}

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
  const streamSeqRef = useRef(0);

  const handleStreamError = (error: unknown, streamId: number, source: "start" | "resume", abortController: AbortController) => {
    warnReviewStream("stream error observed", {
      streamId,
      source,
      signalAborted: abortController.signal.aborted,
      activeControllerMatches: abortControllerRef.current === abortController,
      error: describeStreamError(error),
    });

    if (error instanceof Error && error.name === "AbortError") {
      dispatch({ type: "COMPLETE" });
    } else {
      const message = error instanceof Error ? error.message : "Failed to stream";
      dispatch({ type: "ERROR", error: message });
    }
  };

  const dispatchEvent = (event: ReviewEvent, streamId: number, source: "start" | "resume") => {
    logReviewStream("event", {
      streamId,
      source,
      type: event.type,
      reviewId: "reviewId" in event ? event.reviewId : undefined,
    });
    dispatch({ type: "EVENT", event });
  };

  const cancelStream = (reason: string) => {
    logReviewStream("cancelStream called", {
      reason,
      hasController: Boolean(abortControllerRef.current),
      signalAborted: abortControllerRef.current?.signal.aborted,
      stack: getDebugStack(),
    });

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const stop = () => {
    logReviewStream("stop called");
    cancelStream("stop");
    dispatch({ type: "COMPLETE" });
  };

  const abort = () => {
    logReviewStream("abort called");
    cancelStream("abort");
    dispatch({ type: "RESET" });
  };

  const start = async (mode: ReviewMode, lenses?: LensId[]) => {
    const streamId = ++streamSeqRef.current;
    logReviewStream("start called", {
      streamId,
      mode,
      lenses,
      hadActiveController: Boolean(abortControllerRef.current),
    });
    cancelStream("start:replace-current");

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    dispatch({ type: "START" });
    logReviewStream("start dispatched START", { streamId });

    try {
      const result = await api.streamReviewWithEvents({
        mode,
        lenses,
        signal: abortController.signal,
        onAgentEvent: (event) => dispatchEvent(event, streamId, "start"),
        onStepEvent: (event) => dispatchEvent(event, streamId, "start"),
        onEnrichEvent: (event) => dispatchEvent(event, streamId, "start"),
      });

      logReviewStream("start result", {
        streamId,
        ok: result.ok,
        signalAborted: abortController.signal.aborted,
        activeControllerMatches: abortControllerRef.current === abortController,
        error: result.ok ? undefined : result.error,
      });

      if (!result.ok) {
        dispatch({ type: "ERROR", error: result.error.message });
      } else {
        dispatch({ type: "SET_REVIEW_ID", reviewId: result.value.reviewId });
        dispatch({ type: "COMPLETE" });
      }
    } catch (e) {
      handleStreamError(e, streamId, "start", abortController);
    } finally {
      logReviewStream("start finally", {
        streamId,
        signalAborted: abortController.signal.aborted,
        activeControllerMatches: abortControllerRef.current === abortController,
      });
      abortControllerRef.current = null;
    }
  };

  const resume = async (reviewId: string): Promise<Result<void, StreamReviewError>> => {
    const streamId = ++streamSeqRef.current;
    logReviewStream("resume called", {
      streamId,
      reviewId,
      hadActiveController: Boolean(abortControllerRef.current),
    });
    cancelStream("resume:replace-current");

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    dispatch({ type: "START" });
    dispatch({ type: "SET_REVIEW_ID", reviewId });
    logReviewStream("resume dispatched START and SET_REVIEW_ID", { streamId, reviewId });

    try {
      const result = await api.resumeReviewStream({
        reviewId,
        signal: abortController.signal,
        onAgentEvent: (event) => dispatchEvent(event, streamId, "resume"),
        onStepEvent: (event) => dispatchEvent(event, streamId, "resume"),
        onEnrichEvent: (event) => dispatchEvent(event, streamId, "resume"),
      });

      logReviewStream("resume result", {
        streamId,
        reviewId,
        ok: result.ok,
        signalAborted: abortController.signal.aborted,
        activeControllerMatches: abortControllerRef.current === abortController,
        error: result.ok ? undefined : result.error,
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
      handleStreamError(e, streamId, "resume", abortController);
      return err({ code: "STREAM_ERROR" as const, message: e instanceof Error ? e.message : "Failed to resume" });
    } finally {
      logReviewStream("resume finally", {
        streamId,
        reviewId,
        signalAborted: abortController.signal.aborted,
        activeControllerMatches: abortControllerRef.current === abortController,
      });
      abortControllerRef.current = null;
    }
  };

  useEffect(() => {
    logReviewStream("hook mounted");
    return () => {
      logReviewStream("hook cleanup");
      cancelStream("hook cleanup");
    };
  }, []);

  return { state, start, stop, abort, resume };
}
