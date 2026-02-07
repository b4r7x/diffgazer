import { describe, it, expect } from "vitest";
import {
  reviewReducer,
  createInitialReviewState,
  type ReviewState,
  type ReviewAction,
} from "@stargazer/core/review";
import type { StepEvent, AgentStreamEvent } from "@stargazer/schemas/events";

// The webReviewReducer is not exported, so we test the core reviewReducer
// which handles all the event processing logic. The web wrapper only adds
// reviewId tracking on top.

describe("reviewReducer", () => {
  it("should create initial state with isStreaming=false", () => {
    const state = createInitialReviewState();
    expect(state.isStreaming).toBe(false);
    expect(state.error).toBeNull();
    expect(state.agents).toEqual([]);
    expect(state.issues).toEqual([]);
    expect(state.events).toEqual([]);
  });

  it("START should reset state and set isStreaming=true", () => {
    const state: ReviewState = {
      ...createInitialReviewState(),
      error: "old error",
      isStreaming: false,
    };
    const next = reviewReducer(state, { type: "START" });
    expect(next.isStreaming).toBe(true);
    expect(next.error).toBeNull();
  });

  it("COMPLETE should set isStreaming=false", () => {
    const state: ReviewState = {
      ...createInitialReviewState(),
      isStreaming: true,
    };
    const next = reviewReducer(state, { type: "COMPLETE" });
    expect(next.isStreaming).toBe(false);
  });

  it("ERROR should set error and stop streaming", () => {
    const state: ReviewState = {
      ...createInitialReviewState(),
      isStreaming: true,
    };
    const next = reviewReducer(state, { type: "ERROR", error: "something failed" });
    expect(next.isStreaming).toBe(false);
    expect(next.error).toBe("something failed");
  });

  it("RESET should return initial state", () => {
    const state: ReviewState = {
      ...createInitialReviewState(),
      isStreaming: true,
      error: "err",
    };
    const next = reviewReducer(state, { type: "RESET" });
    expect(next.isStreaming).toBe(false);
    expect(next.error).toBeNull();
    expect(next.events).toEqual([]);
  });

  it("EVENT with review_started should set fileProgress.total and startedAt", () => {
    const state = createInitialReviewState();
    const event: StepEvent = {
      type: "review_started",
      reviewId: "r1",
      filesTotal: 10,
      timestamp: "2025-01-01T00:00:00Z",
    } as StepEvent;
    const next = reviewReducer(state, { type: "EVENT", event });
    expect(next.fileProgress.total).toBe(10);
    expect(next.startedAt).toBeInstanceOf(Date);
    expect(next.events).toHaveLength(1);
  });

  it("EVENT with step_start should set step to active", () => {
    const state = createInitialReviewState();
    const event: StepEvent = {
      type: "step_start",
      step: "diff",
      timestamp: "2025-01-01T00:00:00Z",
    } as StepEvent;
    const next = reviewReducer(state, { type: "EVENT", event });
    const diffStep = next.steps.find((s) => s.id === "diff");
    expect(diffStep?.status).toBe("active");
  });

  it("EVENT with step_complete should set step to completed", () => {
    const state = createInitialReviewState();
    const event: StepEvent = {
      type: "step_complete",
      step: "diff",
      timestamp: "2025-01-01T00:00:00Z",
    } as StepEvent;
    const next = reviewReducer(state, { type: "EVENT", event });
    const diffStep = next.steps.find((s) => s.id === "diff");
    expect(diffStep?.status).toBe("completed");
  });

  it("EVENT with step_error should set error and stop streaming", () => {
    const state: ReviewState = {
      ...createInitialReviewState(),
      isStreaming: true,
    };
    const event: StepEvent = {
      type: "step_error",
      step: "review",
      error: "AI error",
      timestamp: "2025-01-01T00:00:00Z",
    } as StepEvent;
    const next = reviewReducer(state, { type: "EVENT", event });
    expect(next.error).toBe("AI error");
    expect(next.isStreaming).toBe(false);
  });

  it("EVENT with agent_queued should add agent to list", () => {
    const state = createInitialReviewState();
    const event: AgentStreamEvent = {
      type: "agent_queued",
      agent: { id: "a1", name: "Security", badgeLabel: "SEC", lensId: "security" },
      timestamp: "2025-01-01T00:00:00Z",
    } as AgentStreamEvent;
    const next = reviewReducer(state, { type: "EVENT", event });
    expect(next.agents).toHaveLength(1);
    expect(next.agents[0]?.status).toBe("queued");
  });

  it("EVENT with agent_complete should update agent status", () => {
    const state: ReviewState = {
      ...createInitialReviewState(),
      agents: [{
        id: "a1",
        meta: { id: "a1", name: "Security", badgeLabel: "SEC", lensId: "security" },
        status: "running",
        progress: 50,
        issueCount: 0,
        currentAction: "Analyzing",
        startedAt: "2025-01-01T00:00:00Z",
        completedAt: undefined,
      }] as any,
    };
    const event: AgentStreamEvent = {
      type: "agent_complete",
      agent: "a1",
      issueCount: 3,
      timestamp: "2025-01-01T00:01:00Z",
    } as AgentStreamEvent;
    const next = reviewReducer(state, { type: "EVENT", event });
    expect(next.agents[0]?.status).toBe("complete");
    expect(next.agents[0]?.issueCount).toBe(3);
    expect(next.agents[0]?.progress).toBe(100);
  });

  it("EVENT with issue_found should add issue to list", () => {
    const state = createInitialReviewState();
    const event: AgentStreamEvent = {
      type: "issue_found",
      agent: "a1",
      issue: { id: "i1", title: "Bug", severity: "high" },
      timestamp: "2025-01-01T00:00:00Z",
    } as unknown as AgentStreamEvent;
    const next = reviewReducer(state, { type: "EVENT", event });
    expect(next.issues).toHaveLength(1);
    expect(next.issues[0]?.id).toBe("i1");
  });

  it("should accumulate events across multiple dispatches", () => {
    let state = createInitialReviewState();
    const event1: StepEvent = {
      type: "step_start",
      step: "diff",
      timestamp: "2025-01-01T00:00:00Z",
    } as StepEvent;
    const event2: StepEvent = {
      type: "step_complete",
      step: "diff",
      timestamp: "2025-01-01T00:00:01Z",
    } as StepEvent;
    state = reviewReducer(state, { type: "EVENT", event: event1 });
    state = reviewReducer(state, { type: "EVENT", event: event2 });
    expect(state.events).toHaveLength(2);
  });
});
