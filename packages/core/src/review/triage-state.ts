import type { AgentStreamEvent, AgentState, TriageIssue } from "@repo/schemas";
import type { StepEvent, StepState, StepId } from "@repo/schemas/step-event";
import { createInitialSteps, STEP_METADATA } from "@repo/schemas/step-event";
import { AGENT_METADATA, type AgentId } from "@repo/schemas/agent-event";

// Unified triage state for web and CLI
export interface TriageState {
  steps: StepState[];
  agents: AgentState[];
  issues: TriageIssue[];
  isStreaming: boolean;
  error: string | null;
}

export type TriageAction =
  | { type: "START" }
  | { type: "EVENT"; event: AgentStreamEvent | StepEvent }
  | { type: "COMPLETE" }
  | { type: "ERROR"; error: string }
  | { type: "RESET" };

export function createInitialTriageState(): TriageState {
  return {
    steps: createInitialSteps(),
    agents: [],
    issues: [],
    isStreaming: false,
    error: null,
  };
}

function updateStepStatus(steps: StepState[], stepId: StepId, status: StepState["status"]): StepState[] {
  return steps.map((step) =>
    step.id === stepId ? { ...step, status } : step
  );
}

function updateAgents(agents: AgentState[], event: AgentStreamEvent): AgentState[] {
  if (event.type === "agent_start") {
    const newAgent: AgentState = {
      id: event.agent.id,
      meta: event.agent,
      status: "running",
      progress: 0,
      issueCount: 0,
      currentAction: "Starting...",
    };
    const index = agents.findIndex((a) => a.id === event.agent.id);
    if (index >= 0) {
      const updated = [...agents];
      updated[index] = newAgent;
      return updated;
    }
    return [...agents, newAgent];
  }
  if (event.type === "agent_thinking") {
    return agents.map((a) =>
      a.id === event.agent ? { ...a, currentAction: event.thought } : a
    );
  }
  if (event.type === "tool_call") {
    return agents.map((a) =>
      a.id === event.agent
        ? { ...a, lastToolCall: event.tool, currentAction: `Using tool: ${event.tool}` }
        : a
    );
  }
  if (event.type === "agent_complete") {
    return agents.map((a) =>
      a.id === event.agent
        ? { ...a, status: "complete", issueCount: event.issueCount, currentAction: "Completed", progress: 100 }
        : a
    );
  }
  return agents;
}

function updateIssues(issues: TriageIssue[], event: AgentStreamEvent): TriageIssue[] {
  if (event.type === "issue_found" && event.issue) {
    return [...issues, event.issue as TriageIssue];
  }
  return issues;
}

function isStepEvent(event: AgentStreamEvent | StepEvent): event is StepEvent {
  const type = event.type;
  return type === "step_start" || type === "step_complete" || type === "step_error";
}

export function triageReducer(state: TriageState, action: TriageAction): TriageState {
  switch (action.type) {
    case "START":
      return { ...createInitialTriageState(), isStreaming: true };

    case "EVENT": {
      const event = action.event;

      if (isStepEvent(event)) {
        if (event.type === "step_start") {
          return { ...state, steps: updateStepStatus(state.steps, event.step, "active") };
        }
        if (event.type === "step_complete") {
          return { ...state, steps: updateStepStatus(state.steps, event.step, "completed") };
        }
        if (event.type === "step_error") {
          return {
            ...state,
            steps: updateStepStatus(state.steps, event.step, "error"),
            error: event.error,
          };
        }
        return state;
      }

      // Agent events
      return {
        ...state,
        agents: updateAgents(state.agents, event),
        issues: updateIssues(state.issues, event),
      };
    }

    case "COMPLETE":
      return { ...state, isStreaming: false };

    case "ERROR":
      return { ...state, isStreaming: false, error: action.error };

    case "RESET":
      return createInitialTriageState();

    default:
      return state;
  }
}
