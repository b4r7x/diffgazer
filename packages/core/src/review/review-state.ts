import type { AgentStreamEvent, AgentState, EnrichEvent, StepEvent, StepState, StepId } from "@diffgazer/schemas/events";
import { createInitialSteps, isStepEvent } from "@diffgazer/schemas/events";
import type { ReviewIssue } from "@diffgazer/schemas/review";

export interface FileProgress {
  total: number;
  current: number;
  currentFile: string | null;
  completed: string[];
}

export type ReviewEvent = AgentStreamEvent | StepEvent | EnrichEvent;

// Unified review state for web and CLI
export interface ReviewState {
  steps: StepState[];
  agents: AgentState[];
  issues: ReviewIssue[];
  events: ReviewEvent[];
  fileProgress: FileProgress;
  isStreaming: boolean;
  error: string | null;
  startedAt: Date | null;
}

export type ReviewAction =
  | { type: "START" }
  | { type: "EVENT"; event: ReviewEvent }
  | { type: "COMPLETE" }
  | { type: "ERROR"; error: string }
  | { type: "RESET" };

export function createInitialReviewState(): ReviewState {
  return {
    steps: createInitialSteps(),
    agents: [],
    issues: [],
    events: [],
    fileProgress: { total: 0, current: 0, currentFile: null, completed: [] },
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

function upsertAgent(agents: AgentState[], newAgent: AgentState): AgentState[] {
  const index = agents.findIndex((a) => a.id === newAgent.id);
  if (index >= 0) {
    const updated = [...agents];
    updated[index] = { ...updated[index], ...newAgent };
    return updated;
  }
  return [...agents, newAgent];
}

function updateAgents(agents: AgentState[], event: AgentStreamEvent): AgentState[] {
  switch (event.type) {
    case "agent_queued":
      return upsertAgent(agents, {
        id: event.agent.id,
        meta: event.agent,
        status: "queued",
        progress: 0,
        issueCount: 0,
        currentAction: "Queued",
        startedAt: undefined,
        completedAt: undefined,
      });

    case "agent_start":
      return upsertAgent(agents, {
        id: event.agent.id,
        meta: event.agent,
        status: "running",
        progress: 10,
        issueCount: 0,
        currentAction: "Starting...",
        startedAt: event.timestamp,
        completedAt: undefined,
      });

    case "agent_thinking":
      return agents.map((a) =>
        a.id === event.agent ? { ...a, currentAction: event.thought } : a
      );

    case "agent_progress":
      return agents.map((a) =>
        a.id === event.agent
          ? { ...a, progress: event.progress, currentAction: event.message ?? a.currentAction }
          : a
      );

    case "tool_call":
    case "tool_start":
      return agents.map((a) =>
        a.id === event.agent ? { ...a, currentAction: `Using tool: ${event.tool}`, lastToolCall: event.tool } : a
      );

    case "tool_result":
    case "tool_end":
      return agents.map((a) =>
        a.id === event.agent ? { ...a, currentAction: event.summary || undefined } : a
      );

    case "agent_error":
      return agents.map((a) =>
        a.id === event.agent
          ? { ...a, status: "error", error: event.error, currentAction: "Failed", completedAt: event.timestamp, progress: 100 }
          : a
      );

    case "agent_complete":
      return agents.map((a) =>
        a.id === event.agent
          ? { ...a, status: "complete", issueCount: event.issueCount, currentAction: "Completed", progress: 100, completedAt: event.timestamp }
          : a
      );

    default:
      return agents;
  }
}

function updateIssues(issues: ReviewIssue[], event: AgentStreamEvent): ReviewIssue[] {
  if (event.type === "issue_found" && event.issue) {
    return [...issues, event.issue];
  }
  return issues;
}

function handleStepEvent(state: ReviewState, event: StepEvent): ReviewState {
  switch (event.type) {
    case "review_started":
      return {
        ...state,
        fileProgress: { ...state.fileProgress, total: event.filesTotal },
        startedAt: new Date(event.timestamp),
        events: [...state.events, event],
      };

    case "step_start":
      return {
        ...state,
        steps: updateStepStatus(state.steps, event.step, "active"),
        events: [...state.events, event],
      };

    case "step_complete":
      return {
        ...state,
        steps: updateStepStatus(state.steps, event.step, "completed"),
        events: [...state.events, event],
      };

    case "step_error":
      return {
        ...state,
        steps: updateStepStatus(state.steps, event.step, "error"),
        events: [...state.events, event],
        error: event.error,
        isStreaming: false,
      };
  }
}

function handleFileEvent(
  state: ReviewState,
  event: Extract<AgentStreamEvent, { type: "file_start" | "file_complete" }>,
): ReviewState {
  if (event.scope === "agent") {
    return {
      ...state,
      agents: updateAgents(state.agents, event),
      issues: updateIssues(state.issues, event),
      events: [...state.events, event],
    };
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

  const newCompleted = state.fileProgress.completed.includes(event.file)
    ? state.fileProgress.completed
    : [...state.fileProgress.completed, event.file];
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

function handleEnrichEvent(state: ReviewState, event: EnrichEvent): ReviewState {
  return {
    ...state,
    events: [...state.events, event],
  };
}

function handleToolEvent(
  state: ReviewState,
  event: Extract<AgentStreamEvent, { type: "tool_call" | "tool_start" }>,
): ReviewState {
  if (event.tool === "readFileContext") {
    const colonIndex = event.input.indexOf(':');
    const filePath = colonIndex === -1 ? event.input : event.input.substring(0, colonIndex);
    const newCompleted = state.fileProgress.completed.includes(filePath)
      ? state.fileProgress.completed
      : [...state.fileProgress.completed, filePath];
    return {
      ...state,
      agents: updateAgents(state.agents, event),
      fileProgress: {
        ...state.fileProgress,
        completed: newCompleted,
        current: newCompleted.length,
        currentFile: filePath,
      },
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

export function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  switch (action.type) {
    case "START":
      return { ...createInitialReviewState(), isStreaming: true };

    case "EVENT": {
      const event = action.event;

      if (isStepEvent(event)) {
        return handleStepEvent(state, event);
      }

      if (event.type === "file_start" || event.type === "file_complete") {
        return handleFileEvent(state, event);
      }

      if (event.type === "enrich_progress") {
        return handleEnrichEvent(state, event);
      }

      if (event.type === "tool_call" || event.type === "tool_start") {
        return handleToolEvent(state, event);
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
      return createInitialReviewState();

    default: {
      const _exhaustive: never = action;
      return state;
    }
  }
}
