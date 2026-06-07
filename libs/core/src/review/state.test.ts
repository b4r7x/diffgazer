import { describe, expect, it } from "vitest";
import type { AgentStreamEvent, EnrichEvent, StepEvent } from "../schemas/events/index.js";
import {
  createInitialReviewState,
  type ReviewAction,
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

    const failed = reviewReducer(started, { type: "ERROR", error: "Network failed" });
    expect(failed).toMatchObject({ isStreaming: false, error: "Network failed" });

    const restarted = reviewReducer(failed, { type: "START" });
    expect(restarted).toMatchObject({
      startedAt: null,
      agents: [],
      issues: [],
      error: null,
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

  it("tracks agent queue, execution, tools, errors, and completion", () => {
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
          event: {
            type: "tool_start",
            agent: "detective",
            tool: "searchCode",
            input: "query",
            timestamp: ts,
          },
        },
        {
          type: "EVENT",
          event: {
            type: "tool_result",
            agent: "detective",
            tool: "searchCode",
            summary: "",
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
      lastToolCall: "searchCode",
    });
    expect(state.agents[1]).toMatchObject({
      id: "guardian",
      status: "complete",
      progress: 100,
      issueCount: 3,
    });
  });

  it("keeps current agent action when progress has no message and clears it for empty tool summaries", () => {
    const state = reduce(
      [
        { type: "EVENT", event: { type: "agent_start", agent: optimizer, timestamp: ts } },
        {
          type: "EVENT",
          event: { type: "agent_progress", agent: "optimizer", progress: 50, timestamp: ts },
        },
        {
          type: "EVENT",
          event: {
            type: "tool_result",
            agent: "optimizer",
            tool: "readFileContext",
            summary: "",
            timestamp: ts,
          },
        },
      ],
      startedState(),
    );

    expect(state.agents[0]).toMatchObject({ progress: 50 });
    expect(state.agents[0]?.currentAction).toBeUndefined();
  });

  it("tracks file progress, readFileContext paths, deduplication, and issues", () => {
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
            type: "tool_call",
            agent: "detective",
            tool: "readFileContext",
            input: "src/index.ts",
            timestamp: ts,
          },
        },
        {
          type: "EVENT",
          event: {
            type: "tool_call",
            agent: "detective",
            tool: "readFileContext",
            input: "src/app.ts:10-50",
            timestamp: ts,
          },
        },
        { type: "EVENT", event: issueFound("i1", "Bug A", "detective") },
        { type: "EVENT", event: issueFound("i2", "Bug B", "guardian") },
        {
          type: "EVENT",
          event: {
            type: "orchestrator_complete",
            summary: "Done",
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
        summary: "Done",
        totalIssues: 0,
        lensStats: [],
        filesAnalyzed: 0,
        timestamp: ts,
      },
    });
    expect(unchangedTotal.fileProgress.total).toBe(12);
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

  it("updates steps and enrich event history", () => {
    const enrichEvent: EnrichEvent = {
      type: "enrich_progress",
      issueId: "i1",
      enrichmentType: "blame",
      status: "started",
      timestamp: ts,
    };
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
        { type: "EVENT", event: enrichEvent },
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
    expect(state.events.filter((event) => event.type === "enrich_progress")).toEqual([enrichEvent]);
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
    it("routes step events to step handling", () => {
      const state = reviewReducer(startedState(), {
        type: "EVENT",
        event: { type: "step_start", step: "review", timestamp: ts } satisfies StepEvent,
      });

      expect(state.steps.find((step) => step.id === "review")?.status).toBe("active");
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

    it("routes enrich events to history only", () => {
      const enrichEvent: EnrichEvent = {
        type: "enrich_progress",
        issueId: "i1",
        enrichmentType: "blame",
        status: "started",
        timestamp: ts,
      };
      const before = startedState();
      const state = reviewReducer(before, { type: "EVENT", event: enrichEvent });

      expect(state.events.at(-1)).toEqual(enrichEvent);
      expect(state.agents).toBe(before.agents);
      expect(state.steps).toBe(before.steps);
      expect(state.fileProgress).toBe(before.fileProgress);
    });

    it("routes tool events to the originating agent action", () => {
      const state = reduce(
        [
          { type: "EVENT", event: { type: "agent_start", agent: detective, timestamp: ts } },
          {
            type: "EVENT",
            event: {
              type: "tool_call",
              agent: "detective",
              tool: "grep",
              input: "needle",
              timestamp: ts,
            },
          },
        ],
        startedState(),
      );

      expect(state.agents.find((agent) => agent.id === "detective")?.currentAction).toBe(
        "Using tool: grep",
      );
    });

    it("routes orchestrator_complete with a file count to the total", () => {
      const state = reviewReducer(startedState(), {
        type: "EVENT",
        event: {
          type: "orchestrator_complete",
          summary: "Done",
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
