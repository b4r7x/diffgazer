import type { AgentStreamEvent, AgentState, TriageIssue } from "@repo/schemas";
import type { StepEvent, StepState, StepId } from "@repo/schemas/step-event";
import { createInitialSteps, isStepEvent } from "@repo/schemas/step-event";

export interface FileProgress {
  total: number;
  processed: Set<string>;
}

// Unified triage state for web and CLI
export interface TriageState {
  steps: StepState[];
  agents: AgentState[];
  issues: TriageIssue[];
  events: (AgentStreamEvent | StepEvent)[];
  fileProgress: FileProgress;
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
    events: [],
    fileProgress: { total: 0, processed: new Set() },
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
      progress: 50,
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
      a.id === event.agent ? { ...a, currentAction: `Using tool: ${event.tool}` } : a
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
    // Server emits full TriageIssue in issue_found events (see apps/server/src/review/triage.ts)
    return [...issues, event.issue as TriageIssue];
  }
  return issues;
}

function extractFilePath(toolInput: string): string {
  const colonIndex = toolInput.indexOf(':');
  return colonIndex === -1 ? toolInput : toolInput.substring(0, colonIndex);
}

export function triageReducer(state: TriageState, action: TriageAction): TriageState {
  switch (action.type) {
    case "START":
      return { ...createInitialTriageState(), isStreaming: true };

    case "EVENT": {
      const event = action.event;

      if (isStepEvent(event)) {
        if (event.type === "step_start") {
          return {
            ...state,
            steps: updateStepStatus(state.steps, event.step, "active"),
            events: [...state.events, event],
          };
        }
        if (event.type === "step_complete") {
          return {
            ...state,
            steps: updateStepStatus(state.steps, event.step, "completed"),
            events: [...state.events, event],
          };
        }
        if (event.type === "step_error") {
          return {
            ...state,
            steps: updateStepStatus(state.steps, event.step, "error"),
            events: [...state.events, event],
            error: event.error,
            isStreaming: false,
          };
        }
        return state;
      }

      // Handle tool_call for readFileContext to track file progress
      if (event.type === "tool_call" && event.tool === "readFileContext") {
        const newProcessed = new Set(state.fileProgress.processed);
        newProcessed.add(extractFilePath(event.input));
        return {
          ...state,
          agents: updateAgents(state.agents, event),
          fileProgress: { ...state.fileProgress, processed: newProcessed },
          events: [...state.events, event],
        };
      }

      // Handle orchestrator_complete to set total files
      if (event.type === "orchestrator_complete" && event.filesAnalyzed) {
        return {
          ...state,
          fileProgress: { ...state.fileProgress, total: event.filesAnalyzed },
          events: [...state.events, event],
        };
      }

      // Agent events - accumulate for activity log
      return {
        ...state,
        agents: updateAgents(state.agents, event),
        issues: updateIssues(state.issues, event),
        events: [...state.events, event],
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
