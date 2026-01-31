import { useReducer, useCallback, useRef } from "react";
import { streamTriageWithEvents, type StreamTriageRequest } from "../api/triage-api";
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

export function useTriageStream() {
  const [state, dispatch] = useReducer(webTriageReducer, createInitialWebState());
  const abortControllerRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    dispatch({ type: "COMPLETE" });
  }, []);

  const start = useCallback(async (options: StreamTriageRequest) => {
    console.log('[HOOK:START]', options);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    dispatch({ type: "START" });

    try {
      const result = await streamTriageWithEvents({
        ...options,
        signal: abortController.signal,
        onAgentEvent: (event: AgentStreamEvent) => {
          console.log('[HOOK:AGENT_EVENT]', event.type, event);
          dispatch({ type: "EVENT", event });
        },
        onStepEvent: (event: StepEvent) => {
          console.log('[HOOK:STEP_EVENT]', event.type, event);
          dispatch({ type: "EVENT", event });
        },
      });
      console.log('[HOOK:STREAM_RESULT]', result.ok ? 'success' : 'error', result);

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
  }, []);

  const selectIssue = useCallback((issueId: string | null) => {
      dispatch({ type: "SELECT_ISSUE", issueId });
  }, []);

  // Note: We intentionally don't abort on cleanup to handle React Strict Mode.
  // The stream will complete naturally or be aborted explicitly via stop().
  // This prevents Strict Mode's simulated unmount from killing active streams.

  return {
    state,
    start,
    stop,
    selectIssue
  };
}
