import { useReducer, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import type { StreamReviewRequest, StreamReviewError } from "@stargazer/api/review";
import type { AgentStreamEvent, EnrichEvent, StepEvent } from "@stargazer/schemas/events";
import type { Result } from "@stargazer/core/result";
import {
  reviewReducer,
  createInitialReviewState,
  type ReviewState as CoreReviewState,
  type ReviewAction as CoreReviewAction,
} from "@stargazer/core/review";
import { ReviewErrorCode } from "@stargazer/schemas/review";

interface WebReviewState extends CoreReviewState {
  selectedIssueId: string | null;
  reviewId: string | null;
}

type WebReviewAction =
  | CoreReviewAction
  | { type: "SELECT_ISSUE"; issueId: string | null }
  | { type: "SET_REVIEW_ID"; reviewId: string };

function createInitialWebState(): WebReviewState {
  return {
    ...createInitialReviewState(),
    selectedIssueId: null,
    reviewId: null,
  };
}

function webReviewReducer(state: WebReviewState, action: WebReviewAction): WebReviewState {
  switch (action.type) {
    case "SELECT_ISSUE":
      return { ...state, selectedIssueId: action.issueId };
    case "SET_REVIEW_ID":
      return { ...state, reviewId: action.reviewId };
    case "START":
    case "RESET":
      return { ...reviewReducer(state, action), selectedIssueId: null, reviewId: null };
  }

  if (action.type === "EVENT" && action.event.type === "review_started") {
    const newState = reviewReducer(state, action);
    return {
      ...newState,
      selectedIssueId: state.selectedIssueId,
      reviewId: action.event.reviewId,
    };
  }

  return { ...reviewReducer(state, action), selectedIssueId: state.selectedIssueId, reviewId: state.reviewId };
}

type ReviewEvent = AgentStreamEvent | StepEvent | EnrichEvent;

interface UseReviewStreamReturn {
  state: WebReviewState;
  start: (options: StreamReviewRequest) => Promise<void>;
  stop: () => void;
  resume: (reviewId: string) => Promise<Result<void, StreamReviewError>>;
  selectIssue: (issueId: string | null) => void;
}

export function useReviewStream(): UseReviewStreamReturn {
  const [state, dispatch] = useReducer(webReviewReducer, createInitialWebState());
  const abortControllerRef = useRef<AbortController | null>(null);

  const eventQueueRef = useRef<Array<{ type: 'EVENT', event: ReviewEvent }>>([]);
  const rafScheduledRef = useRef(false);

  const handleStreamError = useCallback((error: unknown) => {
    if (error instanceof Error && error.name === "AbortError") {
      dispatch({ type: "COMPLETE" });
    } else {
      const message = error instanceof Error ? error.message : "Failed to stream";
      dispatch({ type: "ERROR", error: message });
    }
  }, []);

  const enqueueEvent = useCallback((event: ReviewEvent) => {
    // review_started bypasses queue for immediate URL update
    if (event.type === 'review_started') {
      dispatch({ type: "EVENT", event });
      return;
    }

    eventQueueRef.current.push({ type: 'EVENT', event });

    if (!rafScheduledRef.current) {
      rafScheduledRef.current = true;
      requestAnimationFrame(() => {
        rafScheduledRef.current = false;
        const events = eventQueueRef.current;
        eventQueueRef.current = [];
        for (const action of events) {
          dispatch(action);
        }
      });
    }
  }, []);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    dispatch({ type: "COMPLETE" });
  }, []);

  const start = useCallback(async (options: StreamReviewRequest) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    eventQueueRef.current = [];
    dispatch({ type: "START" });

    try {
      const result = await api.streamReviewWithEvents({
        ...options,
        signal: abortController.signal,
        onAgentEvent: enqueueEvent,
        onStepEvent: enqueueEvent,
        onEnrichEvent: enqueueEvent,
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
  }, [enqueueEvent, handleStreamError]);

  const selectIssue = useCallback((issueId: string | null) => {
    dispatch({ type: "SELECT_ISSUE", issueId });
  }, []);

  const resume = useCallback(async (reviewId: string): Promise<Result<void, StreamReviewError>> => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    eventQueueRef.current = [];
    dispatch({ type: "START" });

    try {
      const result = await api.resumeReviewStream({
        reviewId,
        signal: abortController.signal,
        onAgentEvent: enqueueEvent,
        onStepEvent: enqueueEvent,
        onEnrichEvent: enqueueEvent,
      });

      if (result.ok) {
        dispatch({ type: "COMPLETE" });
      } else if (
        result.error.code !== ReviewErrorCode.SESSION_STALE &&
        result.error.code !== ReviewErrorCode.SESSION_NOT_FOUND
      ) {
        dispatch({ type: "ERROR", error: result.error.message });
      }
      return result;
    } catch (e) {
      handleStreamError(e);
      throw e;
    } finally {
      abortControllerRef.current = null;
    }
  }, [enqueueEvent, handleStreamError]);

  // Note: We intentionally don't abort on cleanup to handle React Strict Mode.
  // The stream will complete naturally or be aborted explicitly via stop().
  // This prevents Strict Mode's simulated unmount from killing active streams.

  return {
    state,
    start,
    stop,
    resume,
    selectIssue
  };
}
