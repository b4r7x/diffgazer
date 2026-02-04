import type { AgentStreamEvent, AgentState, TriageIssue } from "@stargazer/schemas";
import type { EnrichEvent } from "@stargazer/schemas/enrich-event";
import type { StepEvent, StepState, StepId } from "@stargazer/schemas/step-event";
import { createInitialSteps, isStepEvent } from "@stargazer/schemas/step-event";

export interface FileProgress {
  total: number;
  current: number;
  currentFile: string | null;
  completed: Set<string>;
}

// All event types that can flow through the triage stream
export type TriageEvent = AgentStreamEvent | StepEvent | EnrichEvent;

// Unified triage state for web and CLI
export interface TriageState {
  steps: StepState[];
  agents: AgentState[];
  issues: TriageIssue[];
  events: TriageEvent[];
  fileProgress: FileProgress;
  isStreaming: boolean;
  error: string | null;
  startedAt: Date | null;
}

export type TriageAction =
  | { type: "START" }
  | { type: "EVENT"; event: TriageEvent }
  | { type: "COMPLETE" }
  | { type: "ERROR"; error: string }
  | { type: "RESET" };

export function createInitialTriageState(): TriageState {
  return {
    steps: createInitialSteps(),
    agents: [],
    issues: [],
    events: [],
    fileProgress: { total: 0, current: 0, currentFile: null, completed: new Set() },
    isStreaming: false,
    error: null,
    startedAt: null,
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

export function triageReducer(state: TriageState, action: TriageAction): TriageState {
  switch (action.type) {
    case "START":
      return { ...createInitialTriageState(), isStreaming: true };

    case "EVENT": {
      const event = action.event;

      if (isStepEvent(event)) {
        if (event.type === "review_started") {
          return {
            ...state,
            fileProgress: {
              ...state.fileProgress,
              total: event.filesTotal,
            },
            startedAt: new Date(event.timestamp),
            events: [...state.events, event],
          };
        }
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

      if (event.type === "file_start") {
        return {
          ...state,
          fileProgress: {
            ...state.fileProgress,
            current: event.index,
            currentFile: event.file,
          },
          events: [...state.events, event],
        };
      }

      if (event.type === "file_complete") {
        const newCompleted = new Set(state.fileProgress.completed);
        newCompleted.add(event.file);
        return {
          ...state,
          fileProgress: {
            ...state.fileProgress,
            completed: newCompleted,
            currentFile: null,
          },
          events: [...state.events, event],
        };
      }

      if (event.type === "enrich_progress") {
        return {
          ...state,
          events: [...state.events, event],
        };
      }

      if (event.type === "tool_call" && event.tool === "readFileContext") {
        const colonIndex = event.input.indexOf(':');
        const filePath = colonIndex === -1 ? event.input : event.input.substring(0, colonIndex);
        const newCompleted = new Set(state.fileProgress.completed);
        newCompleted.add(filePath);
        return {
          ...state,
          agents: updateAgents(state.agents, event),
          fileProgress: { ...state.fileProgress, completed: newCompleted },
          events: [...state.events, event],
        };
      }

      if (event.type === "orchestrator_complete" && event.filesAnalyzed) {
        return {
          ...state,
          fileProgress: { ...state.fileProgress, total: event.filesAnalyzed },
          events: [...state.events, event],
        };
      }

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
