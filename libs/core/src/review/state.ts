import type {
  AgentState,
  AgentStreamEvent,
  LensStat,
  StepEvent,
  StepId,
  StepState,
} from "../schemas/events/index.js";
import { createInitialSteps } from "../schemas/events/index.js";
import { ReviewErrorCode, type ReviewIssue, type ReviewSeverity } from "../schemas/review/index.js";
import { appendEvent, createEventHistory } from "./event-sequence.js";
import { isFatalStepFailure } from "./lifecycle.js";
import type { StreamReviewError } from "./stream.js";

export interface FileProgress {
  total: number;
  /** File paths covered by file_progress events; review analysis uses this for prompt inclusion. */
  completed: string[];
}

export type ReviewEvent = AgentStreamEvent | StepEvent;

/**
 * Every code that can reach review state comes from the schema-validated stream
 * failure contract, so the state keeps that closed vocabulary instead of `string`
 * — the reconnect and cancellation branches compare against exact members.
 */
export type ReviewStateErrorCode = StreamReviewError["code"];

/** Deduplication and per-lens totals reported by the terminal orchestrator event. */
export interface OrchestratorStats {
  lensStats?: LensStat[];
  droppedDuplicates?: number;
  droppedBelowThreshold?: number;
  minSeverity?: ReviewSeverity;
}

// Unified review state for web and CLI
export interface ReviewState {
  steps: StepState[];
  agents: AgentState[];
  issues: ReviewIssue[];
  events: ReviewEvent[];
  fileProgress: FileProgress;
  isStreaming: boolean;
  error: string | null;
  errorCode: ReviewStateErrorCode | null;
  startedAt: Date | null;
  orchestratorStats: OrchestratorStats;
}

export type ReviewAction =
  | { type: "START" }
  | { type: "EVENT"; event: ReviewEvent }
  | { type: "COMPLETE_WITH_RESULT"; issues: ReviewIssue[] }
  | { type: "CANCELLED" }
  | { type: "SETTLE" }
  | { type: "ERROR"; error: string; errorCode?: ReviewStateErrorCode | null }
  | { type: "RESET" };

export function createInitialReviewState(): ReviewState {
  return {
    steps: createInitialSteps(),
    agents: [],
    issues: [],
    events: createEventHistory(),
    fileProgress: { total: 0, completed: [] },
    isStreaming: false,
    error: null,
    errorCode: null,
    startedAt: null,
    orchestratorStats: {},
  };
}

function updateStepStatus(
  steps: StepState[],
  stepId: StepId,
  status: StepState["status"],
): StepState[] {
  return steps.map((step) => (step.id === stepId ? { ...step, status } : step));
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
      return agents.map((a) => (a.id === event.agent ? { ...a, currentAction: event.thought } : a));

    case "agent_progress":
      return agents.map((a) =>
        a.id === event.agent
          ? { ...a, progress: event.progress, currentAction: event.message ?? a.currentAction }
          : a,
      );

    case "agent_error":
      return agents.map((a) =>
        a.id === event.agent
          ? {
              ...a,
              status: "error",
              error: event.error,
              currentAction: "Failed",
              completedAt: event.timestamp,
              progress: 100,
            }
          : a,
      );

    case "agent_complete":
      return agents.map((a) =>
        a.id === event.agent
          ? {
              ...a,
              status: "complete",
              issueCount: event.issueCount,
              currentAction: "Completed",
              progress: 100,
              completedAt: event.timestamp,
            }
          : a,
      );

    default:
      return agents;
  }
}

function updateIssues(issues: ReviewIssue[], event: AgentStreamEvent): ReviewIssue[] {
  if (event.type === "issue_found") {
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
        events: appendEvent(state.events, event),
      };

    case "step_start":
      return {
        ...state,
        steps: updateStepStatus(state.steps, event.step, "active"),
        events: appendEvent(state.events, event),
      };

    case "step_complete":
      return {
        ...state,
        steps: updateStepStatus(state.steps, event.step, "completed"),
        events: appendEvent(state.events, event),
      };

    case "step_error": {
      const isFatal = isFatalStepFailure(event.step);
      return {
        ...state,
        steps: updateStepStatus(state.steps, event.step, "error"),
        events: appendEvent(state.events, event),
        ...(isFatal ? { error: event.error, errorCode: null, isStreaming: false } : {}),
      };
    }
  }
}

function handleFileProgressEvent(
  state: ReviewState,
  event: Extract<AgentStreamEvent, { type: "file_progress" }>,
): ReviewState {
  const newCompleted = state.fileProgress.completed.includes(event.file)
    ? state.fileProgress.completed
    : [...state.fileProgress.completed, event.file];
  return {
    ...state,
    fileProgress: {
      ...state.fileProgress,
      total: Math.max(state.fileProgress.total, event.total),
      completed: newCompleted,
    },
    events: appendEvent(state.events, event),
  };
}

const STEP_EVENT_TYPES: Record<StepEvent["type"], true> = {
  review_started: true,
  step_start: true,
  step_complete: true,
  step_error: true,
};

function isStepReviewEvent(event: ReviewEvent): event is StepEvent {
  return event.type in STEP_EVENT_TYPES;
}

// Routes a review event to the handler that owns its sub-type. Step, file-progress
// and orchestrator-complete events have dedicated handlers; all remaining
// agent/issue events fall through to the agent path.
function dispatchEvent(state: ReviewState, event: ReviewEvent): ReviewState {
  if (isStepReviewEvent(event)) {
    return handleStepEvent(state, event);
  }

  if (event.type === "file_progress") {
    return handleFileProgressEvent(state, event);
  }

  if (event.type === "orchestrator_complete") {
    return {
      ...state,
      // A degenerate complete event reporting zero files must not wipe the
      // total already established by the stream.
      fileProgress: event.filesAnalyzed
        ? { ...state.fileProgress, total: event.filesAnalyzed }
        : state.fileProgress,
      orchestratorStats: {
        lensStats: event.lensStats,
        droppedDuplicates: event.droppedDuplicates,
        droppedBelowThreshold: event.droppedBelowThreshold,
        minSeverity: event.minSeverity,
      },
      events: appendEvent(state.events, event),
    };
  }

  return {
    ...state,
    agents: updateAgents(state.agents, event),
    issues: updateIssues(state.issues, event),
    events: appendEvent(state.events, event),
  };
}

export function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  switch (action.type) {
    case "START":
      return { ...createInitialReviewState(), isStreaming: true };

    case "EVENT":
      return dispatchEvent(state, action.event);

    case "COMPLETE_WITH_RESULT":
      return { ...state, isStreaming: false, issues: action.issues };

    case "CANCELLED":
      return {
        ...state,
        isStreaming: false,
        error: null,
        errorCode: ReviewErrorCode.CANCELLED,
      };

    case "SETTLE":
      return {
        ...state,
        isStreaming: false,
      };

    case "ERROR":
      return {
        ...state,
        isStreaming: false,
        error: action.error,
        errorCode: action.errorCode ?? null,
      };

    case "RESET":
      return createInitialReviewState();

    default: {
      const _exhaustive: never = action;
      return state;
    }
  }
}
