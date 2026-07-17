import type {
  AgentState,
  AgentStreamEvent,
  StepEvent,
  StepId,
  StepState,
} from "../schemas/events/index.js";
import { createInitialSteps } from "../schemas/events/index.js";
import { ReviewErrorCode, type ReviewIssue } from "../schemas/review/index.js";

export interface FileProgress {
  total: number;
  current: number;
  currentFile: string | null;
  /** File paths covered by file_progress events; review analysis uses this for prompt inclusion. */
  completed: string[];
}

export type ReviewEvent = AgentStreamEvent | StepEvent;

export interface ReviewEventSequence {
  readonly firstIndex: number;
  readonly nextIndex: number;
  readonly stream: symbol;
  readonly token: object;
}

const eventSequences = new WeakMap<readonly ReviewEvent[], ReviewEventSequence>();
const eventTransitions = new WeakMap<object, WeakMap<ReviewEvent, object>>();

function createSequenceToken(): object {
  return Object.freeze({});
}

function getTransitionToken(parentToken: object, event: ReviewEvent): object {
  let transitions = eventTransitions.get(parentToken);
  if (!transitions) {
    transitions = new WeakMap();
    eventTransitions.set(parentToken, transitions);
  }

  const existing = transitions.get(event);
  if (existing) return existing;
  const token = createSequenceToken();
  transitions.set(event, token);
  return token;
}

export function getReviewEventSequence(
  events: readonly ReviewEvent[],
): ReviewEventSequence | undefined {
  return eventSequences.get(events);
}

export function isReviewEventSequenceContinuation(
  previous: ReviewEventSequence,
  next: ReviewEventSequence,
  nextEvents: readonly ReviewEvent[],
): boolean {
  if (previous.stream !== next.stream) return false;
  if (next.nextIndex - next.firstIndex !== nextEvents.length) return false;
  if (next.firstIndex < previous.firstIndex || next.firstIndex > previous.nextIndex) return false;
  if (next.nextIndex < previous.nextIndex) return false;

  const firstAppendedEvent = previous.nextIndex - next.firstIndex;
  let token = previous.token;
  for (let eventIndex = firstAppendedEvent; eventIndex < nextEvents.length; eventIndex += 1) {
    const event = nextEvents[eventIndex];
    if (!event) return false;
    const nextToken = eventTransitions.get(token)?.get(event);
    if (!nextToken) return false;
    token = nextToken;
  }
  return token === next.token;
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
  errorCode: string | null;
  startedAt: Date | null;
}

export type ReviewAction =
  | { type: "START" }
  | { type: "EVENT"; event: ReviewEvent }
  | { type: "COMPLETE" }
  | { type: "COMPLETE_WITH_RESULT"; issues: ReviewIssue[] }
  | { type: "CANCELLED" }
  | { type: "ERROR"; error: string; errorCode?: string | null }
  | { type: "RESET" };

// Cap on retained streaming events. A long review can emit thousands of agent
// events; without a cap, `[...state.events, event]` becomes O(n) per dispatch
// and the array dominates memory. Once the cap is reached, the oldest events
// are dropped from the head. UI consumers (`convertAgentEventsToLogEntries`,
// log rendering) operate on a windowed view, so dropping ancient events is
// safe for the live log.
const MAX_EVENTS = 5000;

function appendEvent(events: ReviewEvent[], event: ReviewEvent): ReviewEvent[] {
  const droppedCount = Math.max(0, events.length - MAX_EVENTS + 1);
  const nextEvents = [...events.slice(droppedCount), event];
  const previousSequence = eventSequences.get(events);
  const firstIndex = previousSequence ? previousSequence.firstIndex + droppedCount : 0;

  eventSequences.set(nextEvents, {
    firstIndex,
    nextIndex: previousSequence ? previousSequence.nextIndex + 1 : nextEvents.length,
    stream: previousSequence?.stream ?? Symbol("review-event-stream"),
    token: previousSequence
      ? getTransitionToken(previousSequence.token, event)
      : createSequenceToken(),
  });
  return nextEvents;
}

function createEventHistory(): ReviewEvent[] {
  const events: ReviewEvent[] = [];
  eventSequences.set(events, {
    firstIndex: 0,
    nextIndex: 0,
    stream: Symbol("review-event-stream"),
    token: createSequenceToken(),
  });
  return events;
}

export function createInitialReviewState(): ReviewState {
  return {
    steps: createInitialSteps(),
    agents: [],
    issues: [],
    events: createEventHistory(),
    fileProgress: { total: 0, current: 0, currentFile: null, completed: [] },
    isStreaming: false,
    error: null,
    errorCode: null,
    startedAt: null,
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
      // Context step errors are non-fatal warnings; the review continues
      // without project context. Only stop streaming for critical step failures.
      const isFatal = event.step !== "context";
      return {
        ...state,
        steps: updateStepStatus(state.steps, event.step, "error"),
        events: appendEvent(state.events, event),
        ...(isFatal ? { error: event.error, errorCode: null, isStreaming: false } : {}),
      };
    }
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
      events: appendEvent(state.events, event),
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
      events: appendEvent(state.events, event),
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
    events: appendEvent(state.events, event),
  };
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
      current: event.completed,
      currentFile: event.completed < event.total ? event.file : null,
    },
    events: appendEvent(state.events, event),
  };
}

function isStepReviewEvent(event: ReviewEvent): event is StepEvent {
  switch (event.type) {
    case "review_started":
    case "step_start":
    case "step_complete":
    case "step_error":
      return true;

    case "orchestrator_start":
    case "agent_queued":
    case "file_start":
    case "file_complete":
    case "agent_start":
    case "agent_thinking":
    case "agent_progress":
    case "agent_error":
    case "file_progress":
    case "issue_found":
    case "agent_complete":
    case "orchestrator_complete":
      return false;

    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

// Routes a review event to the handler that owns its sub-type. Step, file, and
// file-progress events have dedicated handlers; the orchestrator-complete total
// and all remaining agent/issue events fall through to the agent path.
function dispatchEvent(state: ReviewState, event: ReviewEvent): ReviewState {
  if (isStepReviewEvent(event)) {
    return handleStepEvent(state, event);
  }

  if (event.type === "file_start" || event.type === "file_complete") {
    return handleFileEvent(state, event);
  }

  if (event.type === "file_progress") {
    return handleFileProgressEvent(state, event);
  }

  if (event.type === "orchestrator_complete" && event.filesAnalyzed) {
    return {
      ...state,
      fileProgress: { ...state.fileProgress, total: event.filesAnalyzed },
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

    case "COMPLETE":
      return { ...state, isStreaming: false };

    case "COMPLETE_WITH_RESULT":
      return { ...state, isStreaming: false, issues: action.issues };

    case "CANCELLED":
      return {
        ...state,
        isStreaming: false,
        error: null,
        errorCode: ReviewErrorCode.CANCELLED,
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
