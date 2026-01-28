import { useReducer, useCallback, useRef, useEffect } from "react";
import { streamTriage, type TriageOptions } from "../api/triage-api";
import type { AgentStreamEvent, AgentState, TriageIssue } from "@repo/schemas";

interface TriageState {
  issues: TriageIssue[];
  agents: AgentState[];
  isStreaming: boolean;
  error: string | null;
  selectedIssueId: string | null;
}

type TriageAction =
  | { type: "START" }
  | { type: "ADD_EVENT"; event: AgentStreamEvent }
  | { type: "COMPLETE" }
  | { type: "ERROR"; error: string }
  | { type: "RESET" }
  | { type: "SELECT_ISSUE"; issueId: string | null };

const initialState: TriageState = {
  issues: [],
  agents: [],
  isStreaming: false,
  error: null,
  selectedIssueId: null,
};

function updateAgents(agents: AgentState[], event: AgentStreamEvent): AgentState[] {
    if (event.type === 'agent_start') {
        // Add new agent or update existing (though start implies new/start)
        const newAgent: AgentState = {
            id: event.agent.id,
            meta: event.agent,
            status: 'running',
            progress: 0,
            issueCount: 0,
            currentAction: 'Starting...',
        };
        // Check if exists
        const index = agents.findIndex(a => a.id === event.agent.id);
        if (index >= 0) {
             const newAgents = [...agents];
             newAgents[index] = newAgent;
             return newAgents;
        }
        return [...agents, newAgent];
    } else if (event.type === 'agent_thinking') {
        return agents.map(a => a.id === event.agent ? { ...a, currentAction: event.thought } : a);
    } else if (event.type === 'tool_call') {
        return agents.map(a => a.id === event.agent ? { ...a, lastToolCall: event.tool, currentAction: `Using tool: ${event.tool}` } : a);
    } else if (event.type === 'agent_complete') {
        return agents.map(a => a.id === event.agent ? { ...a, status: 'complete', issueCount: event.issueCount, currentAction: 'Completed', progress: 100 } : a);
    }
    return agents;
}

function updateIssues(issues: TriageIssue[], event: AgentStreamEvent): TriageIssue[] {
     if (event.type === 'issue_found' && event.issue) {
         return [...issues, event.issue as TriageIssue];
     }
     return issues;
}

function triageReducer(state: TriageState, action: TriageAction): TriageState {
  switch (action.type) {
    case "START":
      return { ...initialState, isStreaming: true };
    case "ADD_EVENT":
      return {
          ...state,
          agents: updateAgents(state.agents, action.event),
          issues: updateIssues(state.issues, action.event),
      };
    case "COMPLETE":
      return { ...state, isStreaming: false };
    case "ERROR":
      return { ...state, isStreaming: false, error: action.error };
    case "RESET":
      return initialState;
    case "SELECT_ISSUE":
      return { ...state, selectedIssueId: action.issueId };
    default:
      return state;
  }
}

export function useTriageStream() {
  const [state, dispatch] = useReducer(triageReducer, initialState);
  const cleanupRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    dispatch({ type: "COMPLETE" });
  }, []);

  const start = useCallback((options: TriageOptions) => {
    if (cleanupRef.current) {
      cleanupRef.current();
    }

    dispatch({ type: "START" });

    try {
      cleanupRef.current = streamTriage(options, {
        onEvent: (event) => {
          dispatch({ type: "ADD_EVENT", event });
        },
        onError: (error) => {
          dispatch({ type: "ERROR", error: error.message });
        },
        onComplete: () => {
          dispatch({ type: "COMPLETE" });
          cleanupRef.current = null;
        },
      });
    } catch (e) {
      dispatch({ type: "ERROR", error: e instanceof Error ? e.message : "Failed to start stream" });
    }
  }, []);

  const selectIssue = useCallback((issueId: string | null) => {
      dispatch({ type: "SELECT_ISSUE", issueId });
  }, []);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
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
