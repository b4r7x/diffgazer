import { describe, expect, it } from "vitest";
import {
  type AgentStreamEvent,
  AgentStreamEventSchema,
  type StepEvent,
} from "../schemas/events/index.js";
import { ReviewErrorCode } from "../schemas/review/index.js";
import {
  createInitialReviewState,
  getReviewEventSequence,
  isReviewEventSequenceContinuation,
  type ReviewAction,
  type ReviewEvent,
  type ReviewState,
  reviewReducer,
} from "./state.js";

const ts = "2025-02-01T10:00:00Z";

const detective = {
  id: "detective",
  lens: "correctness",
  name: "Detective",
  badgeLabel: "DET",
  badgeVariant: "info",
  description: "Finds bugs",
} as const;

const guardian = {
  id: "guardian",
  lens: "security",
  name: "Guardian",
  badgeLabel: "SEC",
  badgeVariant: "warning",
  description: "Security",
} as const;

const optimizer = {
  id: "optimizer",
  lens: "performance",
  name: "Optimizer",
  badgeLabel: "PERF",
  badgeVariant: "info",
  description: "Perf",
} as const;

function reduce(actions: ReviewAction[], state = createInitialReviewState()): ReviewState {
  return actions.reduce(reviewReducer, state);
}

function startedState(): ReviewState {
  return reduce([
    { type: "START" },
    {
      type: "EVENT",
      event: { type: "review_started", reviewId: "r1", filesTotal: 5, timestamp: ts },
    },
  ]);
}

function issueFound(id: string, title: string, agent: "detective" | "guardian"): AgentStreamEvent {
  return {
    type: "issue_found",
    agent,
    issue: {
      id,
      title,
      severity: "high",
      category: agent === "guardian" ? "security" : "correctness",
      file: `${id}.ts`,
      line_start: 1,
      line_end: 1,
      rationale: "desc",
      recommendation: "fix",
      suggested_patch: null,
      confidence: 0.9,
      symptom: "symptom",
      whyItMatters: "matters",
      evidence: [],
    },
    timestamp: ts,
  };
}

describe("review-state", () => {
  it("handles lifecycle actions and review start metadata", () => {
    const initial = createInitialReviewState();

    expect(initial.startedAt).toBeNull();
    expect(initial.isStreaming).toBe(false);
    expect(initial.errorCode).toBeNull();

    const started = reduce([
      { type: "START" },
      {
        type: "EVENT",
        event: {
          type: "review_started",
          reviewId: "review-123",
          filesTotal: 25,
          timestamp: "2025-02-01T10:30:00Z",
        },
      },
    ]);

    expect(started.isStreaming).toBe(true);
    expect(started.startedAt?.getTime()).toBe(new Date("2025-02-01T10:30:00Z").getTime());
    expect(started.fileProgress.total).toBe(25);
    expect(started.events).toEqual([
      expect.objectContaining({ type: "review_started", reviewId: "review-123" }),
    ]);

    const failed = reviewReducer(started, {
      type: "ERROR",
      error: "No staged changes found",
      errorCode: ReviewErrorCode.NO_DIFF,
    });
    expect(failed).toMatchObject({
      isStreaming: false,
      error: "No staged changes found",
      errorCode: ReviewErrorCode.NO_DIFF,
    });

    const restarted = reviewReducer(failed, { type: "START" });
    expect(restarted).toMatchObject({
      startedAt: null,
      agents: [],
      issues: [],
      error: null,
      errorCode: null,
      isStreaming: true,
    });

    expect(reviewReducer(started, { type: "RESET" })).toEqual(createInitialReviewState());
  });

  it("preserves issues when a review completes", () => {
    const withIssue = reviewReducer(startedState(), {
      type: "EVENT",
      event: issueFound("i1", "Bug found", "detective"),
    });

    const completed = reviewReducer(withIssue, { type: "COMPLETE" });

    expect(completed.isStreaming).toBe(false);
    expect(completed.issues).toEqual([expect.objectContaining({ title: "Bug found" })]);
  });

  it("marks cancellation without turning it into an error", () => {
    const cancelled = reviewReducer(startedState(), { type: "CANCELLED" });

    expect(cancelled.isStreaming).toBe(false);
    expect(cancelled.error).toBeNull();
    expect(cancelled.errorCode).toBe(ReviewErrorCode.CANCELLED);
  });

  it("tracks agent queue, execution, errors, and completion", () => {
    const queueEvent: AgentStreamEvent = {
      type: "agent_queued",
      agent: detective,
      position: 1,
      total: 3,
      timestamp: ts,
    };
    const state = reduce(
      [
        { type: "EVENT", event: queueEvent },
        { type: "EVENT", event: queueEvent },
        { type: "EVENT", event: { type: "agent_start", agent: detective, timestamp: ts } },
        {
          type: "EVENT",
          event: {
            type: "agent_thinking",
            agent: "detective",
            thought: "Analyzing patterns",
            timestamp: ts,
          },
        },
        {
          type: "EVENT",
          event: {
            type: "agent_progress",
            agent: "detective",
            progress: 75,
            message: "Almost done",
            timestamp: ts,
          },
        },
        {
          type: "EVENT",
          event: { type: "agent_error", agent: "detective", error: "Timeout", timestamp: ts },
        },
        { type: "EVENT", event: { type: "agent_start", agent: guardian, timestamp: ts } },
        {
          type: "EVENT",
          event: { type: "agent_complete", agent: "guardian", issueCount: 3, timestamp: ts },
        },
      ],
      startedState(),
    );

    expect(state.agents).toHaveLength(2);
    expect(state.agents[0]).toMatchObject({
      id: "detective",
      status: "error",
      progress: 100,
      error: "Timeout",
      currentAction: "Failed",
    });
    expect(state.agents[1]).toMatchObject({
      id: "guardian",
      status: "complete",
      progress: 100,
      issueCount: 3,
    });
  });

  it("keeps the current agent action when progress has no message", () => {
    const state = reduce(
      [
        { type: "EVENT", event: { type: "agent_start", agent: optimizer, timestamp: ts } },
        {
          type: "EVENT",
          event: { type: "agent_progress", agent: "optimizer", progress: 50, timestamp: ts },
        },
      ],
      startedState(),
    );

    expect(state.agents[0]).toMatchObject({ progress: 50 });
    expect(state.agents[0]?.currentAction).toBe("Starting...");
  });

  it("tracks file progress from file_progress events, deduplication, and issues", () => {
    const state = reduce(
      [
        {
          type: "EVENT",
          event: {
            type: "file_start",
            file: "src/app.ts",
            index: 2,
            total: 5,
            scope: "orchestrator",
            timestamp: ts,
          },
        },
        {
          type: "EVENT",
          event: {
            type: "file_start",
            file: "src/agent.ts",
            index: 3,
            total: 5,
            scope: "agent",
            timestamp: ts,
          },
        },
        {
          type: "EVENT",
          event: { type: "file_complete", file: "src/app.ts", index: 2, total: 5, timestamp: ts },
        },
        {
          type: "EVENT",
          event: { type: "file_complete", file: "src/app.ts", index: 2, total: 5, timestamp: ts },
        },
        { type: "EVENT", event: { type: "agent_start", agent: detective, timestamp: ts } },
        {
          type: "EVENT",
          event: {
            type: "file_progress",
            agent: "detective",
            file: "src/index.ts",
            completed: 1,
            total: 12,
            timestamp: ts,
          },
        },
        {
          type: "EVENT",
          event: {
            type: "file_progress",
            agent: "detective",
            file: "src/app.ts",
            completed: 2,
            total: 12,
            timestamp: ts,
          },
        },
        { type: "EVENT", event: issueFound("i1", "Bug A", "detective") },
        { type: "EVENT", event: issueFound("i2", "Bug B", "guardian") },
        {
          type: "EVENT",
          event: {
            type: "orchestrator_complete",
            totalIssues: 2,
            lensStats: [],
            filesAnalyzed: 12,
            timestamp: ts,
          },
        },
      ],
      startedState(),
    );

    expect(state.fileProgress).toMatchObject({
      total: 12,
      current: 2,
      currentFile: "src/app.ts",
      completed: ["src/app.ts", "src/index.ts"],
    });
    expect(state.issues.map((issue) => issue.title)).toEqual(["Bug A", "Bug B"]);

    const unchangedTotal = reviewReducer(state, {
      type: "EVENT",
      event: {
        type: "orchestrator_complete",
        totalIssues: 0,
        lensStats: [],
        filesAnalyzed: 0,
        timestamp: ts,
      },
    });
    expect(unchangedTotal.fileProgress.total).toBe(12);
  });

  it("records prompt coverage without leaving a completed file marked current", () => {
    const state = reviewReducer(startedState(), {
      type: "EVENT",
      event: {
        type: "file_progress",
        agent: "detective",
        file: "src/app.ts",
        completed: 5,
        total: 5,
        timestamp: ts,
      },
    });

    expect(state.fileProgress).toMatchObject({
      total: 5,
      current: 5,
      currentFile: null,
      completed: ["src/app.ts"],
    });
  });

  it("ignores agent-scoped file completions for global file progress", () => {
    const state = reviewReducer(startedState(), {
      type: "EVENT",
      event: {
        type: "file_complete",
        file: "src/agent.ts",
        index: 0,
        total: 5,
        scope: "agent",
        timestamp: ts,
      },
    });

    expect(state.fileProgress.completed).toEqual([]);
  });

  it("updates steps and stops streaming on a fatal step error", () => {
    const state = reduce(
      [
        {
          type: "EVENT",
          event: { type: "step_start", step: "diff", timestamp: ts } satisfies StepEvent,
        },
        {
          type: "EVENT",
          event: { type: "step_complete", step: "diff", timestamp: ts } satisfies StepEvent,
        },
        {
          type: "EVENT",
          event: { type: "step_error", step: "review", error: "AI provider down", timestamp: ts },
        },
      ],
      startedState(),
    );

    expect(state.steps.find((step) => step.id === "diff")?.status).toBe("completed");
    expect(state.steps.find((step) => step.id === "review")?.status).toBe("error");
    expect(state.error).toBe("AI provider down");
    expect(state.isStreaming).toBe(false);
  });

  it("marks context step errors without stopping the review stream", () => {
    const state = reviewReducer(startedState(), {
      type: "EVENT",
      event: {
        type: "step_error",
        step: "context",
        error: "Context unavailable",
        timestamp: ts,
      },
    });

    expect(state.steps.find((step) => step.id === "context")?.status).toBe("error");
    expect(state.error).toBeNull();
    expect(state.isStreaming).toBe(true);
  });

  it("keeps the newest 5000 streamed events and drops the oldest", () => {
    const eventAt = (index: number): AgentStreamEvent => ({
      type: "agent_thinking",
      agent: "detective",
      thought: `event-${index}`,
      timestamp: `${ts}#${index}`,
    });
    const streaming = reviewReducer(createInitialReviewState(), { type: "START" });
    const stateBeforeTrim = reduce(
      Array.from(
        { length: 5000 },
        (_, index): ReviewAction => ({
          type: "EVENT",
          event: eventAt(index),
        }),
      ),
      streaming,
    );
    const state = reduce(
      Array.from(
        { length: 50 },
        (_, offset): ReviewAction => ({
          type: "EVENT",
          event: eventAt(5000 + offset),
        }),
      ),
      stateBeforeTrim,
    );
    const previousSequence = getReviewEventSequence(stateBeforeTrim.events);
    const sequence = getReviewEventSequence(state.events);
    if (!previousSequence || !sequence) throw new Error("Expected tagged event histories");

    expect(state.events).toHaveLength(5000);
    expect(state.events[0]).toEqual(eventAt(50));
    expect(state.events.at(-1)).toEqual(eventAt(5049));
    expect(state.events).not.toContainEqual(eventAt(0));
    expect(sequence).toMatchObject({
      firstIndex: 50,
      nextIndex: 5050,
      stream: previousSequence.stream,
    });
    expect(isReviewEventSequenceContinuation(previousSequence, sequence, state.events)).toBe(true);
  });

  it("uses branch-safe tokens without attaching lineage to event arrays or payloads", () => {
    const base = createInitialReviewState();
    const detectiveEvent: ReviewEvent = {
      type: "agent_thinking",
      agent: "detective",
      thought: "detective branch",
      timestamp: ts,
    };
    const guardianEvent: ReviewEvent = {
      type: "agent_thinking",
      agent: "guardian",
      thought: "guardian branch",
      timestamp: ts,
    };
    const sharedTail: ReviewEvent = {
      type: "agent_thinking",
      agent: "detective",
      thought: "shared tail",
      timestamp: ts,
    };
    const branchA = reviewReducer(base, { type: "EVENT", event: detectiveEvent });
    const repeatedBranchA = reviewReducer(base, { type: "EVENT", event: detectiveEvent });
    const branchB = reviewReducer(base, { type: "EVENT", event: guardianEvent });
    const branchATail = reviewReducer(branchA, { type: "EVENT", event: sharedTail });
    const branchBTail = reviewReducer(branchB, { type: "EVENT", event: sharedTail });
    const sequenceA = getReviewEventSequence(branchA.events);
    const repeatedSequenceA = getReviewEventSequence(repeatedBranchA.events);
    const sequenceB = getReviewEventSequence(branchB.events);
    const sequenceATail = getReviewEventSequence(branchATail.events);
    const sequenceBTail = getReviewEventSequence(branchBTail.events);
    if (!sequenceA || !repeatedSequenceA || !sequenceB || !sequenceATail || !sequenceBTail) {
      throw new Error("Expected tagged event histories");
    }

    expect(sequenceA.token).toBe(repeatedSequenceA.token);
    expect(sequenceA.token).not.toBe(sequenceB.token);
    expect(sequenceATail.token).not.toBe(sequenceBTail.token);
    expect(isReviewEventSequenceContinuation(sequenceA, sequenceB, branchB.events)).toBe(false);
    expect(
      isReviewEventSequenceContinuation(sequenceATail, sequenceBTail, branchBTail.events),
    ).toBe(false);
    expect(Object.keys(sequenceA.token)).toEqual([]);
    expect("parent" in sequenceA.token).toBe(false);
    expect(Object.getOwnPropertySymbols(branchA.events)).toEqual([]);
    expect(JSON.parse(JSON.stringify(branchA.events))).toEqual(branchA.events);
  });

  it("tracks multiple concurrent agents independently", () => {
    const state = reduce(
      [
        { type: "EVENT", event: { type: "agent_start", agent: detective, timestamp: ts } },
        { type: "EVENT", event: { type: "agent_start", agent: guardian, timestamp: ts } },
        {
          type: "EVENT",
          event: { type: "agent_complete", agent: "detective", issueCount: 2, timestamp: ts },
        },
      ],
      startedState(),
    );

    expect(state.agents).toEqual([
      expect.objectContaining({ id: "detective", status: "complete" }),
      expect.objectContaining({ id: "guardian", status: "running" }),
    ]);
  });

  describe("EVENT routing", () => {
    it("routes every step event variant to step handling", () => {
      const events = [
        {
          type: "review_started",
          reviewId: "review-routed",
          filesTotal: 7,
          timestamp: ts,
        },
        { type: "step_start", step: "diff", timestamp: ts },
        { type: "step_complete", step: "context", timestamp: ts },
        {
          type: "step_error",
          step: "report",
          error: "Report failed",
          timestamp: ts,
        },
      ] satisfies StepEvent[];

      const state = reduce(
        events.map((event) => ({ type: "EVENT", event })),
        reviewReducer(createInitialReviewState(), { type: "START" }),
      );

      expect(state.fileProgress.total).toBe(7);
      expect(state.startedAt?.getTime()).toBe(new Date(ts).getTime());
      expect(state.steps.find((step) => step.id === "diff")?.status).toBe("active");
      expect(state.steps.find((step) => step.id === "context")?.status).toBe("completed");
      expect(state.steps.find((step) => step.id === "report")?.status).toBe("error");
      expect(state.error).toBe("Report failed");
      expect(state.events.slice(-events.length)).toEqual(events);
    });

    it("does not route any agent event variant through step handling", () => {
      const events = [
        {
          type: "orchestrator_start",
          agents: [detective],
          concurrency: 1,
          timestamp: ts,
        },
        { type: "agent_queued", agent: detective, position: 1, total: 1, timestamp: ts },
        {
          type: "file_start",
          file: "src/app.ts",
          index: 0,
          total: 1,
          scope: "orchestrator",
          timestamp: ts,
        },
        {
          type: "file_complete",
          file: "src/app.ts",
          index: 0,
          total: 1,
          scope: "orchestrator",
          timestamp: ts,
        },
        { type: "agent_start", agent: detective, timestamp: ts },
        {
          type: "agent_thinking",
          agent: "detective",
          thought: "Reviewing",
          timestamp: ts,
        },
        {
          type: "agent_progress",
          agent: "detective",
          progress: 50,
          message: "Halfway",
          timestamp: ts,
        },
        { type: "agent_error", agent: "detective", error: "Failed", timestamp: ts },
        {
          type: "file_progress",
          agent: "detective",
          file: "src/app.ts",
          completed: 1,
          total: 1,
          timestamp: ts,
        },
        issueFound("routed-issue", "Routed issue", "detective"),
        { type: "agent_complete", agent: "detective", issueCount: 1, timestamp: ts },
        {
          type: "orchestrator_complete",
          totalIssues: 1,
          lensStats: [],
          filesAnalyzed: 1,
          timestamp: ts,
        },
      ] satisfies AgentStreamEvent[];
      const schemaTypes = AgentStreamEventSchema.options.flatMap((option) => [
        ...option.shape.type.values,
      ]);

      expect(events.map((event) => event.type)).toEqual(schemaTypes);
      for (const event of events) {
        const initial = startedState();
        const state = reviewReducer(initial, { type: "EVENT", event });

        expect(state.steps).toEqual(initial.steps);
        expect(state.events.at(-1)).toEqual(event);
      }
    });

    it("routes orchestrator-scoped file events to file progress", () => {
      const state = reviewReducer(startedState(), {
        type: "EVENT",
        event: {
          type: "file_start",
          file: "src/app.ts",
          index: 2,
          total: 5,
          scope: "orchestrator",
          timestamp: ts,
        },
      });

      expect(state.fileProgress.currentFile).toBe("src/app.ts");
      expect(state.agents).toEqual([]);
    });

    it("routes orchestrator_complete with a file count to the total", () => {
      const state = reviewReducer(startedState(), {
        type: "EVENT",
        event: {
          type: "orchestrator_complete",
          totalIssues: 0,
          lensStats: [],
          filesAnalyzed: 9,
          timestamp: ts,
        },
      });

      expect(state.fileProgress.total).toBe(9);
    });

    it("routes unmatched agent events to agent state", () => {
      const state = reviewReducer(startedState(), {
        type: "EVENT",
        event: { type: "agent_start", agent: optimizer, timestamp: ts },
      });

      expect(state.agents).toEqual([
        expect.objectContaining({ id: "optimizer", status: "running" }),
      ]);
    });
  });
});
