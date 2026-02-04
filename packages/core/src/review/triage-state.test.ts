import { describe, it, expect } from "vitest";
import {
  createInitialTriageState,
  triageReducer,
  type TriageState,
  type TriageAction,
} from "./triage-state.js";
import type { ReviewStartedEvent } from "@stargazer/schemas/step-event";
import type { AgentStreamEvent } from "@stargazer/schemas";

describe("triage-state", () => {
  describe("createInitialTriageState", () => {
    it("returns startedAt as null", () => {
      const state = createInitialTriageState();

      expect(state.startedAt).toBeNull();
    });

    it("initializes all required fields", () => {
      const state = createInitialTriageState();

      expect(state.steps).toBeDefined();
      expect(Array.isArray(state.steps)).toBe(true);
      expect(state.agents).toEqual([]);
      expect(state.issues).toEqual([]);
      expect(state.events).toEqual([]);
      expect(state.fileProgress).toBeDefined();
      expect(state.isStreaming).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("triageReducer with review_started event", () => {
    it("sets startedAt from review_started event timestamp", () => {
      const state = createInitialTriageState();
      const timestamp = "2025-02-01T10:30:00Z";
      const event: ReviewStartedEvent = {
        type: "review_started",
        reviewId: "review-123",
        filesTotal: 5,
        timestamp,
      };

      const action: TriageAction = { type: "EVENT", event };
      const newState = triageReducer(state, action);

      expect(newState.startedAt).not.toBeNull();
      expect(newState.startedAt).toBeInstanceOf(Date);
      expect(newState.startedAt?.getTime()).toBe(new Date(timestamp).getTime());
    });

    it("handles ISO timestamp string parsing correctly", () => {
      const state = createInitialTriageState();
      const timestamp = "2025-01-15T14:45:30.123Z";
      const event: ReviewStartedEvent = {
        type: "review_started",
        reviewId: "review-456",
        filesTotal: 10,
        timestamp,
      };

      const action: TriageAction = { type: "EVENT", event };
      const newState = triageReducer(state, action);

      const expectedDate = new Date(timestamp);
      expect(newState.startedAt?.getTime()).toBe(expectedDate.getTime());
    });

    it("sets fileProgress.total from review_started event", () => {
      const state = createInitialTriageState();
      const event: ReviewStartedEvent = {
        type: "review_started",
        reviewId: "review-789",
        filesTotal: 25,
        timestamp: "2025-02-01T10:30:00Z",
      };

      const action: TriageAction = { type: "EVENT", event };
      const newState = triageReducer(state, action);

      expect(newState.fileProgress.total).toBe(25);
    });

    it("adds review_started event to events array", () => {
      const state = createInitialTriageState();
      const event: ReviewStartedEvent = {
        type: "review_started",
        reviewId: "review-999",
        filesTotal: 3,
        timestamp: "2025-02-01T10:30:00Z",
      };

      const action: TriageAction = { type: "EVENT", event };
      const newState = triageReducer(state, action);

      expect(newState.events).toHaveLength(1);
      expect(newState.events[0]).toEqual(event);
    });
  });

  describe("startedAt persistence", () => {
    it("persists startedAt through subsequent events", () => {
      let state = createInitialTriageState();
      const startTimestamp = "2025-02-01T10:30:00Z";
      const reviewStarted: ReviewStartedEvent = {
        type: "review_started",
        reviewId: "review-persist",
        filesTotal: 5,
        timestamp: startTimestamp,
      };

      state = triageReducer(state, { type: "EVENT", event: reviewStarted });
      const initialStartedAt = state.startedAt;

      const agentStartEvent: AgentStreamEvent = {
        type: "agent_start",
        agent: {
          id: "agent-1",
          name: "SecurityAgent",
          role: "security",
        },
      };

      state = triageReducer(state, { type: "EVENT", event: agentStartEvent });

      expect(state.startedAt).toEqual(initialStartedAt);
      expect(state.events).toHaveLength(2);
    });

    it("persists startedAt through multiple agent events", () => {
      let state = createInitialTriageState();
      const startTimestamp = "2025-02-01T10:30:00Z";
      const reviewStarted: ReviewStartedEvent = {
        type: "review_started",
        reviewId: "review-multi",
        filesTotal: 8,
        timestamp: startTimestamp,
      };

      state = triageReducer(state, { type: "EVENT", event: reviewStarted });
      const originalStartedAt = state.startedAt;

      const agentThinkingEvent: AgentStreamEvent = {
        type: "agent_thinking",
        agent: "agent-2",
        thought: "Analyzing security patterns",
      };

      state = triageReducer(state, { type: "EVENT", event: agentThinkingEvent });

      expect(state.startedAt).toEqual(originalStartedAt);

      const toolCallEvent: AgentStreamEvent = {
        type: "tool_call",
        agent: "agent-2",
        tool: "readFileContext",
        input: "src/app.ts:1-50",
      };

      state = triageReducer(state, { type: "EVENT", event: toolCallEvent });

      expect(state.startedAt).toEqual(originalStartedAt);
    });
  });

  describe("START action resets startedAt", () => {
    it("resets startedAt to null on START action", () => {
      let state = createInitialTriageState();
      const reviewStarted: ReviewStartedEvent = {
        type: "review_started",
        reviewId: "review-reset",
        filesTotal: 4,
        timestamp: "2025-02-01T10:30:00Z",
      };

      state = triageReducer(state, { type: "EVENT", event: reviewStarted });
      expect(state.startedAt).not.toBeNull();

      state = triageReducer(state, { type: "START" });

      expect(state.startedAt).toBeNull();
    });

    it("clears all state fields on START action", () => {
      let state = createInitialTriageState();
      const reviewStarted: ReviewStartedEvent = {
        type: "review_started",
        reviewId: "review-start",
        filesTotal: 6,
        timestamp: "2025-02-01T10:30:00Z",
      };

      state = triageReducer(state, { type: "EVENT", event: reviewStarted });
      state = triageReducer(state, { type: "START" });

      const freshState = createInitialTriageState();
      expect(state.startedAt).toBe(freshState.startedAt);
      expect(state.agents).toEqual(freshState.agents);
      expect(state.issues).toEqual(freshState.issues);
      expect(state.error).toEqual(freshState.error);
      expect(state.isStreaming).toBe(true);
    });
  });

  describe("RESET action", () => {
    it("resets startedAt to null on RESET action", () => {
      let state = createInitialTriageState();
      const reviewStarted: ReviewStartedEvent = {
        type: "review_started",
        reviewId: "review-clean",
        filesTotal: 2,
        timestamp: "2025-02-01T10:30:00Z",
      };

      state = triageReducer(state, { type: "EVENT", event: reviewStarted });
      expect(state.startedAt).not.toBeNull();

      state = triageReducer(state, { type: "RESET" });

      expect(state.startedAt).toBeNull();
    });
  });

  describe("Edge cases", () => {
    it("handles timestamp with milliseconds precision", () => {
      const state = createInitialTriageState();
      const timestamp = "2025-02-01T10:30:45.987Z";
      const event: ReviewStartedEvent = {
        type: "review_started",
        reviewId: "review-ms",
        filesTotal: 1,
        timestamp,
      };

      const newState = triageReducer(state, { type: "EVENT", event });
      const expectedDate = new Date(timestamp);

      expect(newState.startedAt?.getMilliseconds()).toBe(
        expectedDate.getMilliseconds()
      );
    });

    it("preserves Date object type for startedAt", () => {
      const state = createInitialTriageState();
      const event: ReviewStartedEvent = {
        type: "review_started",
        reviewId: "review-type",
        filesTotal: 7,
        timestamp: "2025-02-01T10:30:00Z",
      };

      const newState = triageReducer(state, { type: "EVENT", event });

      expect(newState.startedAt).toBeInstanceOf(Date);
      expect(typeof newState.startedAt?.getTime).toBe("function");
    });

    it("handles review_started event without resetting other state", () => {
      let state = createInitialTriageState();
      const initialAgent: AgentStreamEvent = {
        type: "agent_start",
        agent: {
          id: "agent-3",
          name: "PerformanceAgent",
          role: "performance",
        },
      };

      state = triageReducer(state, { type: "EVENT", event: initialAgent });
      expect(state.agents).toHaveLength(1);

      const reviewStarted: ReviewStartedEvent = {
        type: "review_started",
        reviewId: "review-preserve",
        filesTotal: 5,
        timestamp: "2025-02-01T10:30:00Z",
      };

      state = triageReducer(state, { type: "EVENT", event: reviewStarted });

      expect(state.startedAt).not.toBeNull();
      expect(state.agents).toHaveLength(1);
      expect(state.agents[0].id).toBe("agent-3");
    });
  });
});
