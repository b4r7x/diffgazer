import { useReducer, useCallback, useRef, useEffect } from "react";
import { streamTriageWithEvents, type StreamTriageRequest } from "../api/triage-api";
import type { AgentStreamEvent } from "@repo/schemas";
import {
  triageReducer as coreTriageReducer,
  createInitialTriageState,
  type TriageState as CoreTriageState,
  type TriageAction as CoreTriageAction,
} from "@repo/core/review";

// Extend core state with web-specific fields
interface WebTriageState extends CoreTriageState {
  selectedIssueId: string | null;
}

// Extend core actions with web-specific actions
type WebTriageAction =
  | CoreTriageAction
  | { type: "SELECT_ISSUE"; issueId: string | null };

function createInitialWebState(): WebTriageState {
  return {
    ...createInitialTriageState(),
    selectedIssueId: null,
  };
}

function webTriageReducer(state: WebTriageState, action: WebTriageAction): WebTriageState {
  if (action.type === "SELECT_ISSUE") {
    return { ...state, selectedIssueId: action.issueId };
  }
  if (action.type === "START" || action.type === "RESET") {
    return { ...coreTriageReducer(state, action), selectedIssueId: null };
  }
  return { ...coreTriageReducer(state, action), selectedIssueId: state.selectedIssueId };
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
          dispatch({ type: "EVENT", event });
        },
      });

      if (!result.ok) {
        dispatch({ type: "ERROR", error: result.error.message });
      } else {
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

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    state,
    start,
    stop,
    selectIssue
  };
}
