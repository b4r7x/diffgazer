import { useEffect, useReducer, useRef } from "react";
import { getErrorMessage } from "../../errors.js";
import { err, ok, type Result } from "../../result.js";
import { isSessionTerminationCode } from "../../review/lifecycle.js";
import {
  createInitialReviewState,
  type ReviewAction,
  type ReviewEvent,
  type ReviewState,
  reviewReducer,
} from "../../review/state.js";
import type { StreamReviewError } from "../../review/stream.js";
import { ReviewErrorCode } from "../../schemas/review/index.js";
import type { CancelReason } from "../review.js";
import { useApi } from "./context.js";

export type CancelReviewOutcome =
  | { status: "cancelled"; reason: CancelReason }
  | { status: "error"; message: string };

export interface ReviewStreamState extends ReviewState {
  reviewId: string | null;
  hasCompleted: boolean;
  /** Non-blocking server notices (e.g. the streamed event-cap warning). */
  notices: string[];
}

export interface CancelReviewOptions {
  preserveState?: boolean;
}

type StreamAction =
  | ReviewAction
  | { type: "SET_REVIEW_ID"; reviewId: string }
  | { type: "NOTICE"; notice: string };

function createInitialStreamState(): ReviewStreamState {
  return {
    ...createInitialReviewState(),
    reviewId: null,
    hasCompleted: false,
    notices: [],
  };
}

function streamReducer(state: ReviewStreamState, action: StreamAction): ReviewStreamState {
  switch (action.type) {
    case "SET_REVIEW_ID":
      return { ...state, reviewId: action.reviewId };
    case "NOTICE":
      return { ...state, notices: [...state.notices, action.notice] };
    case "START":
    case "RESET":
      return { ...reviewReducer(state, action), reviewId: null, hasCompleted: false, notices: [] };
  }

  if (action.type === "EVENT" && action.event.type === "review_started") {
    const newState = reviewReducer(state, action);
    return {
      ...newState,
      reviewId: action.event.reviewId,
      hasCompleted: state.hasCompleted,
      notices: state.notices,
    };
  }

  return {
    ...reviewReducer(state, action),
    reviewId: state.reviewId,
    hasCompleted: action.type === "COMPLETE_WITH_RESULT" ? true : state.hasCompleted,
    notices: state.notices,
  };
}

export type UseReviewStreamResult = ReturnType<typeof useReviewStream>;

export function useReviewStream() {
  const api = useApi();
  const [state, dispatch] = useReducer(streamReducer, createInitialStreamState());
  const abortControllerRef = useRef<AbortController | null>(null);
  const resumeTokenRef = useRef(0);

  const cancelStream = (reason = "cancel") => {
    resumeTokenRef.current += 1;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort(reason);
      abortControllerRef.current = null;
    }
  };

  const abort = () => {
    cancelStream("abort");
    dispatch({ type: "RESET" });
  };

  /** Abort the client stream AND tell the server to stop work. */
  const cancel = async (
    reviewId: string | null,
    options: CancelReviewOptions = {},
  ): Promise<CancelReviewOutcome | null> => {
    cancelStream("cancel");
    const cancelToken = resumeTokenRef.current;
    const isCurrentCancel = () =>
      resumeTokenRef.current === cancelToken && abortControllerRef.current === null;

    if (!reviewId) {
      if (!options.preserveState) {
        dispatch({ type: "CANCELLED" });
      }
      return { status: "cancelled", reason: "cancelled" };
    }

    try {
      const response = await api.cancelReviewSession(reviewId);
      if (isCurrentCancel()) {
        // A run the server had already finished or committed stops streaming
        // without claiming a cancellation the user never got.
        const claimsCancellation =
          !options.preserveState &&
          (response.reason === "cancelled" || response.reason === "not-found");
        dispatch({ type: claimsCancellation ? "CANCELLED" : "SETTLE" });
      }
      return { status: "cancelled", reason: response.reason };
    } catch (error) {
      const message = getErrorMessage(error, "Failed to cancel the review session.");
      if (isCurrentCancel()) {
        dispatch({ type: "ERROR", error: message });
      }
      return { status: "error", message };
    }
  };

  const resume = async (reviewId: string): Promise<Result<void, StreamReviewError>> => {
    cancelStream("resume");
    const resumeToken = resumeTokenRef.current + 1;
    resumeTokenRef.current = resumeToken;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    dispatch({ type: "START" });
    dispatch({ type: "SET_REVIEW_ID", reviewId });

    const isCurrentResume = () =>
      resumeTokenRef.current === resumeToken && abortControllerRef.current === abortController;

    const dispatchEvent = (event: ReviewEvent) => {
      if (!isCurrentResume()) {
        return;
      }
      dispatch({ type: "EVENT", event });
    };

    const dispatchNotice = (notice: string) => {
      if (!isCurrentResume()) {
        return;
      }
      dispatch({ type: "NOTICE", notice });
    };

    try {
      const result = await api.resumeReviewStream({
        reviewId,
        signal: abortController.signal,
        onAgentEvent: dispatchEvent,
        onStepEvent: dispatchEvent,
        onChunk: dispatchNotice,
      });

      if (!isCurrentResume()) {
        return result.ok ? ok(undefined) : result;
      }

      if (result.ok) {
        const finalIssues = result.value.result.issues;
        dispatch({ type: "COMPLETE_WITH_RESULT", issues: finalIssues });
        return ok(undefined);
      }

      if (
        isSessionTerminationCode(result.error.code) ||
        result.error.code === ReviewErrorCode.SESSION_NOT_FOUND
      ) {
        dispatch({
          type: "ERROR",
          error: result.error.message,
          errorCode: result.error.code,
        });
        return err(result.error);
      }

      dispatch({ type: "ERROR", error: result.error.message, errorCode: result.error.code });
      return err(result.error);
    } catch (e) {
      if (!isCurrentResume()) {
        return err({ code: "STREAM_ERROR" as const, message: "aborted" });
      }
      const message = getErrorMessage(e, "Failed to resume");
      dispatch({ type: "ERROR", error: message, errorCode: "STREAM_ERROR" });
      return err({ code: "STREAM_ERROR" as const, message });
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort("cleanup");
        abortControllerRef.current = null;
      }
    };
  }, []);

  const isStreamControllerActive = () => abortControllerRef.current !== null;

  return { state, abort, cancel, resume, isStreamControllerActive };
}
