import { useReducer, useCallback, useRef } from "react";
import { streamTriageWithEvents, resumeTriageStream, type StreamTriageRequest } from "../api/triage-api";
import type { AgentStreamEvent } from "@repo/schemas";
import type { StepEvent } from "@repo/schemas/step-event";
import {
  triageReducer as coreTriageReducer,
  createInitialTriageState,
  type TriageState as CoreTriageState,
  type TriageAction as CoreTriageAction,
} from "@repo/core/review";

// Extend core state with web-specific fields
interface WebTriageState extends CoreTriageState {
  selectedIssueId: string | null;
  reviewId: string | null;
}

// Extend core actions with web-specific actions
type WebTriageAction =
  | CoreTriageAction
  | { type: "SELECT_ISSUE"; issueId: string | null }
  | { type: "SET_REVIEW_ID"; reviewId: string };

function createInitialWebState(): WebTriageState {
  return {
    ...createInitialTriageState(),
    selectedIssueId: null,
    reviewId: null,
  };
}

function webTriageReducer(state: WebTriageState, action: WebTriageAction): WebTriageState {
  if (action.type === "SELECT_ISSUE") {
    return { ...state, selectedIssueId: action.issueId };
  }
  if (action.type === "SET_REVIEW_ID") {
    return { ...state, reviewId: action.reviewId };
  }
  // Handle review_started event to capture reviewId early
  if (action.type === "EVENT" && action.event.type === "review_started") {
    const newState = coreTriageReducer(state, action);
    return {
      ...newState,
      selectedIssueId: state.selectedIssueId,
      reviewId: action.event.reviewId,
    };
  }
  if (action.type === "START" || action.type === "RESET") {
    return { ...coreTriageReducer(state, action), selectedIssueId: null, reviewId: null };
  }
  return { ...coreTriageReducer(state, action), selectedIssueId: state.selectedIssueId, reviewId: state.reviewId };
}

type TriageEvent = AgentStreamEvent | StepEvent;

export function useTriageStream() {
  const [state, dispatch] = useReducer(webTriageReducer, createInitialWebState());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Event queue for batched UI updates
  const eventQueueRef = useRef<Array<{ type: 'EVENT', event: TriageEvent }>>([]);
  const rafScheduledRef = useRef(false);

  const enqueueEvent = useCallback((event: TriageEvent) => {
    // review_started bypasses queue for immediate URL update
    if (event.type === 'review_started') {
      dispatch({ type: "EVENT", event });
      return;
    }

    eventQueueRef.current.push({ type: 'EVENT', event });

    // Schedule RAF only if not already scheduled
    if (!rafScheduledRef.current) {
      rafScheduledRef.current = true;
      requestAnimationFrame(() => {
        rafScheduledRef.current = false;
        // Dispatch all queued events at once
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

  const start = useCallback(async (options: StreamTriageRequest) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    eventQueueRef.current = [];
    dispatch({ type: "START" });

    try {
      const result = await streamTriageWithEvents({
        ...options,
        signal: abortController.signal,
        onAgentEvent: (event: AgentStreamEvent) => {
          enqueueEvent(event);
        },
        onStepEvent: (event: StepEvent) => {
          enqueueEvent(event);
        },
      });

      if (!result.ok) {
        dispatch({ type: "ERROR", error: result.error.message });
      } else {
        dispatch({ type: "SET_REVIEW_ID", reviewId: result.value.reviewId });
        dispatch({ type: "COMPLETE" });
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        dispatch({ type: "COMPLETE" });
      } else {
        dispatch({ type: "ERROR", error: e instanceof Error ? e.message : "Failed to start stream" });
      }
    } finally {
      abortControllerRef.current = null;
    }
  }, [enqueueEvent]);

  const selectIssue = useCallback((issueId: string | null) => {
      dispatch({ type: "SELECT_ISSUE", issueId });
  }, []);

  const resume = useCallback(async (reviewId: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    eventQueueRef.current = [];
    dispatch({ type: "START" });
    dispatch({ type: "SET_REVIEW_ID", reviewId });

    try {
      const result = await resumeTriageStream({
        reviewId,
        signal: abortController.signal,
        onAgentEvent: (event: AgentStreamEvent) => {
          enqueueEvent(event);
        },
        onStepEvent: (event: StepEvent) => {
          enqueueEvent(event);
        },
      });

      if (result.ok) {
        dispatch({ type: "COMPLETE" });
      } else {
        dispatch({ type: "ERROR", error: result.error.message });
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        dispatch({ type: "COMPLETE" });
      } else {
        dispatch({ type: "ERROR", error: e instanceof Error ? e.message : "Failed to resume stream" });
      }
    } finally {
      abortControllerRef.current = null;
    }
  }, [enqueueEvent]);

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
