import { useEffect, useReducer, useRef } from "react";
import { getErrorMessage } from "../../errors.js";
import { err, ok, type Result } from "../../result.js";
import {
  createInitialReviewState,
  isSessionTerminationCode,
  type ReviewAction,
  type ReviewEvent,
  type ReviewState,
  reviewReducer,
  type StreamReviewError,
} from "../../review/index.js";
import { ReviewErrorCode } from "../../schemas/review/index.js";
import { useApi } from "./context.js";

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

  const next = reviewReducer(state, action);
  return next === state
    ? state
    : {
        ...next,
        reviewId: state.reviewId,
        hasCompleted: action.type === "COMPLETE_WITH_RESULT" ? true : state.hasCompleted,
        notices: state.notices,
      };
}

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

  const stop = () => {
    cancelStream("stop");
    dispatch({ type: "COMPLETE" });
  };

  const abort = () => {
    cancelStream("abort");
    dispatch({ type: "RESET" });
  };

  /** Abort the client stream AND tell the server to stop work. */
  const cancel = async (
    reviewId: string | null,
    options: CancelReviewOptions = {},
  ): Promise<string | null> => {
    cancelStream("cancel");
    const cancelToken = resumeTokenRef.current;
    const isCurrentCancel = () =>
      resumeTokenRef.current === cancelToken && abortControllerRef.current === null;

    if (!options.preserveState) {
      dispatch({ type: "CANCELLED" });
    }

    if (!reviewId) {
      return null;
    }

    try {
      await api.cancelReviewSession(reviewId);
      return null;
    } catch (error) {
      const message = getErrorMessage(error, "Failed to cancel the review session.");
      if (isCurrentCancel()) {
        dispatch({ type: "ERROR", error: message });
      }
      return message;
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
        dispatch({ type: "RESET" });
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

  return { state, stop, abort, cancel, resume };
}
