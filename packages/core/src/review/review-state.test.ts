import { describe, it, expect } from "vitest";
import {
  createInitialReviewState,
  reviewReducer,
  type ReviewState,
  type ReviewAction,
} from "./review-state.js";
import type { ReviewStartedEvent, AgentStreamEvent, StepEvent, EnrichEvent } from "@stargazer/schemas/events";

const ts = "2025-02-01T10:00:00Z";

const makeAgentMeta = (name: string, id: string, lens: string, badgeLabel: string, badgeVariant: string, description: string) =>
  ({ id, lens, name, badgeLabel, badgeVariant, description });

const detective = makeAgentMeta("Detective", "detective", "correctness", "DET", "info", "Finds bugs");
const guardian = makeAgentMeta("Guardian", "guardian", "security", "SEC", "warning", "Security");
const optimizer = makeAgentMeta("Optimizer", "optimizer", "performance", "PERF", "info", "Perf");

function startedState(): ReviewState {
  let state = createInitialReviewState();
  state = reviewReducer(state, { type: "START" });
  state = reviewReducer(state, {
    type: "EVENT",
    event: { type: "review_started", reviewId: "r1", filesTotal: 5, timestamp: ts },
  });
  return state;
}

describe("review-state", () => {
  describe("createInitialReviewState", () => {
    it("returns startedAt as null", () => {
      const state = createInitialReviewState();

      expect(state.startedAt).toBeNull();
    });

  });

  describe("reviewReducer with review_started event", () => {
    it("sets startedAt from review_started event timestamp", () => {
      const state = createInitialReviewState();
      const timestamp = "2025-02-01T10:30:00Z";
      const event: ReviewStartedEvent = {
        type: "review_started",
        reviewId: "review-123",
        filesTotal: 5,
        timestamp,
      };

      const action: ReviewAction = { type: "EVENT", event };
      const newState = reviewReducer(state, action);

      expect(newState.startedAt).not.toBeNull();
      expect(newState.startedAt).toBeInstanceOf(Date);
      expect(newState.startedAt?.getTime()).toBe(new Date(timestamp).getTime());
    });

    it("sets fileProgress.total from review_started event", () => {
      const state = createInitialReviewState();
      const event: ReviewStartedEvent = {
        type: "review_started",
        reviewId: "review-789",
        filesTotal: 25,
        timestamp: "2025-02-01T10:30:00Z",
      };

      const action: ReviewAction = { type: "EVENT", event };
      const newState = reviewReducer(state, action);

      expect(newState.fileProgress.total).toBe(25);
    });

    it("adds review_started event to events array", () => {
      const state = createInitialReviewState();
      const event: ReviewStartedEvent = {
        type: "review_started",
        reviewId: "review-999",
        filesTotal: 3,
        timestamp: "2025-02-01T10:30:00Z",
      };

      const action: ReviewAction = { type: "EVENT", event };
      const newState = reviewReducer(state, action);

      expect(newState.events).toHaveLength(1);
      expect(newState.events[0]).toEqual(event);
    });
  });

  describe("START action resets startedAt", () => {
    it("clears all state fields on START action", () => {
      let state = createInitialReviewState();
      const reviewStarted: ReviewStartedEvent = {
        type: "review_started",
        reviewId: "review-start",
        filesTotal: 6,
        timestamp: "2025-02-01T10:30:00Z",
      };

      state = reviewReducer(state, { type: "EVENT", event: reviewStarted });
      state = reviewReducer(state, { type: "START" });

      const freshState = createInitialReviewState();
      expect(state.startedAt).toBe(freshState.startedAt);
      expect(state.agents).toEqual(freshState.agents);
      expect(state.issues).toEqual(freshState.issues);
      expect(state.error).toEqual(freshState.error);
      expect(state.isStreaming).toBe(true);
    });
  });

  describe("RESET action", () => {
    it("resets startedAt to null on RESET action", () => {
      let state = createInitialReviewState();
      const reviewStarted: ReviewStartedEvent = {
        type: "review_started",
        reviewId: "review-clean",
        filesTotal: 2,
        timestamp: "2025-02-01T10:30:00Z",
      };

      state = reviewReducer(state, { type: "EVENT", event: reviewStarted });
      expect(state.startedAt).not.toBeNull();

      state = reviewReducer(state, { type: "RESET" });

      expect(state.startedAt).toBeNull();
    });
  });

  describe("COMPLETE action", () => {
    it("sets isStreaming to false", () => {
      let state = startedState();
      expect(state.isStreaming).toBe(true);

      state = reviewReducer(state, { type: "COMPLETE" });

      expect(state.isStreaming).toBe(false);
    });

    it("preserves issues on COMPLETE", () => {
      let state = startedState();
      const issueEvent: AgentStreamEvent = {
        type: "issue_found",
        agent: "detective",
        issue: {
          id: "i1",
          title: "Bug found",
          severity: "high",
          category: "correctness",
          file: "src/a.ts",
          line: 1,
          description: "desc",
          codeSnippet: "code",
          suggestion: "fix",
        },
        timestamp: ts,
      };

      state = reviewReducer(state, { type: "EVENT", event: issueEvent });
      expect(state.issues).toHaveLength(1);

      state = reviewReducer(state, { type: "COMPLETE" });

      expect(state.issues).toHaveLength(1);
      expect(state.issues[0].title).toBe("Bug found");
    });
  });

  describe("ERROR action", () => {
    it("sets error and stops streaming", () => {
      let state = startedState();

      state = reviewReducer(state, { type: "ERROR", error: "Network failed" });

      expect(state.isStreaming).toBe(false);
      expect(state.error).toBe("Network failed");
    });
  });

  describe("updateAgents — agent_queued", () => {
    it("adds a new queued agent", () => {
      let state = startedState();
      const event: AgentStreamEvent = {
        type: "agent_queued",
        agent: detective,
        position: 1,
        total: 3,
        timestamp: ts,
      };

      state = reviewReducer(state, { type: "EVENT", event });

      expect(state.agents).toHaveLength(1);
      expect(state.agents[0].status).toBe("queued");
      expect(state.agents[0].id).toBe("detective");
    });

    it("replaces existing agent on re-queue", () => {
      let state = startedState();
      const queueEvent: AgentStreamEvent = {
        type: "agent_queued",
        agent: detective,
        position: 1,
        total: 3,
        timestamp: ts,
      };

      state = reviewReducer(state, { type: "EVENT", event: queueEvent });
      state = reviewReducer(state, { type: "EVENT", event: queueEvent });

      expect(state.agents).toHaveLength(1);
    });
  });

  describe("updateAgents — agent_start", () => {
    it("adds agent with running status", () => {
      let state = startedState();
      const event: AgentStreamEvent = {
        type: "agent_start",
        agent: guardian,
        timestamp: ts,
      };

      state = reviewReducer(state, { type: "EVENT", event });

      expect(state.agents).toHaveLength(1);
      expect(state.agents[0].status).toBe("running");
      expect(state.agents[0].startedAt).toBe(ts);
    });

    it("updates existing queued agent to running", () => {
      let state = startedState();
      const queueEvent: AgentStreamEvent = {
        type: "agent_queued",
        agent: detective,
        position: 1,
        total: 3,
        timestamp: ts,
      };
      const startEvent: AgentStreamEvent = {
        type: "agent_start",
        agent: detective,
        timestamp: ts,
      };

      state = reviewReducer(state, { type: "EVENT", event: queueEvent });
      state = reviewReducer(state, { type: "EVENT", event: startEvent });

      expect(state.agents).toHaveLength(1);
      expect(state.agents[0].status).toBe("running");
    });
  });

  describe("updateAgents — agent_thinking", () => {
    it("updates currentAction with thought", () => {
      let state = startedState();
      state = reviewReducer(state, {
        type: "EVENT",
        event: {
          type: "agent_start",
          agent: detective,
          timestamp: ts,
        },
      });

      state = reviewReducer(state, {
        type: "EVENT",
        event: { type: "agent_thinking", agent: "detective", thought: "Analyzing patterns", timestamp: ts },
      });

      expect(state.agents[0].currentAction).toBe("Analyzing patterns");
    });
  });

  describe("updateAgents — agent_progress", () => {
    it("updates progress and message", () => {
      let state = startedState();
      state = reviewReducer(state, {
        type: "EVENT",
        event: {
          type: "agent_start",
          agent: optimizer,
          timestamp: ts,
        },
      });

      state = reviewReducer(state, {
        type: "EVENT",
        event: { type: "agent_progress", agent: "optimizer", progress: 75, message: "Almost done", timestamp: ts },
      });

      expect(state.agents[0].progress).toBe(75);
      expect(state.agents[0].currentAction).toBe("Almost done");
    });
  });

  describe("updateAgents — tool_call", () => {
    it("updates currentAction and lastToolCall", () => {
      let state = startedState();
      state = reviewReducer(state, {
        type: "EVENT",
        event: {
          type: "agent_start",
          agent: detective,
          timestamp: ts,
        },
      });

      state = reviewReducer(state, {
        type: "EVENT",
        event: { type: "tool_call", agent: "detective", tool: "readFileContext", input: "src/app.ts", timestamp: ts },
      });

      expect(state.agents[0].currentAction).toContain("readFileContext");
      expect(state.agents[0].lastToolCall).toBe("readFileContext");
    });
  });

  describe("updateAgents — tool_result", () => {
    it("updates currentAction with summary", () => {
      let state = startedState();
      state = reviewReducer(state, {
        type: "EVENT",
        event: {
          type: "agent_start",
          agent: detective,
          timestamp: ts,
        },
      });

      state = reviewReducer(state, {
        type: "EVENT",
        event: { type: "tool_result", agent: "detective", tool: "readFileContext", summary: "Read 50 lines", timestamp: ts },
      });

      expect(state.agents[0].currentAction).toBe("Read 50 lines");
    });
  });

  describe("updateAgents — agent_error", () => {
    it("sets agent status to error", () => {
      let state = startedState();
      state = reviewReducer(state, {
        type: "EVENT",
        event: {
          type: "agent_start",
          agent: detective,
          timestamp: ts,
        },
      });

      state = reviewReducer(state, {
        type: "EVENT",
        event: { type: "agent_error", agent: "detective", error: "Timeout", timestamp: ts },
      });

      expect(state.agents[0].status).toBe("error");
      expect(state.agents[0].error).toBe("Timeout");
      expect(state.agents[0].progress).toBe(100);
    });
  });

  describe("updateAgents — agent_complete", () => {
    it("sets agent status to complete with issue count", () => {
      let state = startedState();
      state = reviewReducer(state, {
        type: "EVENT",
        event: {
          type: "agent_start",
          agent: guardian,
          timestamp: ts,
        },
      });

      state = reviewReducer(state, {
        type: "EVENT",
        event: { type: "agent_complete", agent: "guardian", issueCount: 3, timestamp: ts },
      });

      expect(state.agents[0].status).toBe("complete");
      expect(state.agents[0].issueCount).toBe(3);
      expect(state.agents[0].progress).toBe(100);
    });
  });

  describe("file progress", () => {
    it("updates current file on file_start (orchestrator scope)", () => {
      let state = startedState();
      const event: AgentStreamEvent = {
        type: "file_start",
        file: "src/app.ts",
        index: 2,
        total: 5,
        scope: "orchestrator",
        timestamp: ts,
      };

      state = reviewReducer(state, { type: "EVENT", event });

      expect(state.fileProgress.current).toBe(2);
      expect(state.fileProgress.currentFile).toBe("src/app.ts");
    });

    it("ignores file_start with agent scope", () => {
      let state = startedState();
      const event: AgentStreamEvent = {
        type: "file_start",
        file: "src/app.ts",
        index: 2,
        total: 5,
        scope: "agent",
        timestamp: ts,
      };

      state = reviewReducer(state, { type: "EVENT", event });

      expect(state.fileProgress.current).toBe(0);
      expect(state.fileProgress.currentFile).toBeNull();
    });

    it("adds file to completed set on file_complete", () => {
      let state = startedState();
      const event: AgentStreamEvent = {
        type: "file_complete",
        file: "src/app.ts",
        index: 0,
        total: 5,
        timestamp: ts,
      };

      state = reviewReducer(state, { type: "EVENT", event });

      expect(state.fileProgress.completed.includes("src/app.ts")).toBe(true);
      expect(state.fileProgress.currentFile).toBeNull();
    });

    it("ignores file_complete with agent scope", () => {
      let state = startedState();
      const event: AgentStreamEvent = {
        type: "file_complete",
        file: "src/app.ts",
        index: 0,
        total: 5,
        scope: "agent",
        timestamp: ts,
      };

      state = reviewReducer(state, { type: "EVENT", event });

      expect(state.fileProgress.completed.includes("src/app.ts")).toBe(false);
    });
  });

  describe("tool_call with readFileContext — colon parsing", () => {
    it("extracts file path before colon from tool input", () => {
      let state = startedState();
      state = reviewReducer(state, {
        type: "EVENT",
        event: {
          type: "agent_start",
          agent: detective,
          timestamp: ts,
        },
      });

      state = reviewReducer(state, {
        type: "EVENT",
        event: { type: "tool_call", agent: "detective", tool: "readFileContext", input: "src/app.ts:10-50", timestamp: ts },
      });

      expect(state.fileProgress.completed.includes("src/app.ts")).toBe(true);
      expect(state.fileProgress.currentFile).toBe("src/app.ts");
    });

    it("uses full input when no colon present", () => {
      let state = startedState();
      state = reviewReducer(state, {
        type: "EVENT",
        event: {
          type: "agent_start",
          agent: detective,
          timestamp: ts,
        },
      });

      state = reviewReducer(state, {
        type: "EVENT",
        event: { type: "tool_call", agent: "detective", tool: "readFileContext", input: "src/index.ts", timestamp: ts },
      });

      expect(state.fileProgress.completed.includes("src/index.ts")).toBe(true);
    });
  });

  describe("issue_found", () => {
    it("adds issues to state", () => {
      let state = startedState();
      const issue1: AgentStreamEvent = {
        type: "issue_found",
        agent: "detective",
        issue: {
          id: "i1",
          title: "Bug A",
          severity: "high",
          category: "correctness",
          file: "a.ts",
          line: 1,
          description: "desc",
          codeSnippet: "code",
          suggestion: "fix",
        },
        timestamp: ts,
      };
      const issue2: AgentStreamEvent = {
        type: "issue_found",
        agent: "guardian",
        issue: {
          id: "i2",
          title: "Bug B",
          severity: "medium",
          category: "security",
          file: "b.ts",
          line: 5,
          description: "desc2",
          codeSnippet: "code2",
          suggestion: "fix2",
        },
        timestamp: ts,
      };

      state = reviewReducer(state, { type: "EVENT", event: issue1 });
      state = reviewReducer(state, { type: "EVENT", event: issue2 });

      expect(state.issues).toHaveLength(2);
      expect(state.issues[0].title).toBe("Bug A");
      expect(state.issues[1].title).toBe("Bug B");
    });
  });

  describe("step events", () => {
    it("updates step status on step_start", () => {
      let state = startedState();
      const event: StepEvent = { type: "step_start", step: "diff", timestamp: ts };

      state = reviewReducer(state, { type: "EVENT", event });

      const diffStep = state.steps.find((s) => s.id === "diff");
      expect(diffStep?.status).toBe("active");
    });

    it("updates step status on step_complete", () => {
      let state = startedState();
      state = reviewReducer(state, { type: "EVENT", event: { type: "step_start", step: "diff", timestamp: ts } });
      state = reviewReducer(state, { type: "EVENT", event: { type: "step_complete", step: "diff", timestamp: ts } });

      const diffStep = state.steps.find((s) => s.id === "diff");
      expect(diffStep?.status).toBe("completed");
    });

    it("sets error and stops streaming on step_error", () => {
      let state = startedState();
      const event: StepEvent = { type: "step_error", step: "review", error: "AI provider down", timestamp: ts };

      state = reviewReducer(state, { type: "EVENT", event });

      const reviewStep = state.steps.find((s) => s.id === "review");
      expect(reviewStep?.status).toBe("error");
      expect(state.error).toBe("AI provider down");
      expect(state.isStreaming).toBe(false);
    });
  });

  describe("enrich_progress event", () => {
    it("appends to events array", () => {
      let state = startedState();
      const event: EnrichEvent = {
        type: "enrich_progress",
        issueId: "i1",
        enrichmentType: "blame",
        status: "started",
        timestamp: ts,
      };

      state = reviewReducer(state, { type: "EVENT", event });

      const enrichEvents = state.events.filter((e) => e.type === "enrich_progress");
      expect(enrichEvents).toHaveLength(1);
    });
  });

  describe("orchestrator_complete", () => {
    it("updates filesAnalyzed in fileProgress", () => {
      let state = startedState();
      const event: AgentStreamEvent = {
        type: "orchestrator_complete",
        summary: "Done",
        totalIssues: 5,
        lensStats: [],
        filesAnalyzed: 12,
        timestamp: ts,
      };

      state = reviewReducer(state, { type: "EVENT", event });

      expect(state.fileProgress.total).toBe(12);
    });

    it("should not update fileProgress.total when filesAnalyzed is 0", () => {
      let state = startedState();
      const event: AgentStreamEvent = {
        type: "orchestrator_complete",
        summary: "Done",
        totalIssues: 0,
        lensStats: [],
        filesAnalyzed: 0,
        timestamp: ts,
      };

      state = reviewReducer(state, { type: "EVENT", event });

      expect(state.fileProgress.total).toBe(5);
    });
  });

  describe("updateAgents — agent_progress without message", () => {
    it("should fall back to currentAction when message is undefined", () => {
      let state = startedState();
      state = reviewReducer(state, {
        type: "EVENT",
        event: { type: "agent_start", agent: optimizer, timestamp: ts },
      });

      state = reviewReducer(state, {
        type: "EVENT",
        event: { type: "agent_progress", agent: "optimizer", progress: 50, timestamp: ts },
      });

      expect(state.agents[0].progress).toBe(50);
      expect(state.agents[0].currentAction).toBe("Starting...");
    });
  });

  describe("updateAgents — tool_result with empty summary", () => {
    it("should set currentAction to undefined when summary is empty string", () => {
      let state = startedState();
      state = reviewReducer(state, {
        type: "EVENT",
        event: { type: "agent_start", agent: detective, timestamp: ts },
      });

      state = reviewReducer(state, {
        type: "EVENT",
        event: { type: "tool_result", agent: "detective", tool: "readFileContext", summary: "", timestamp: ts },
      });

      expect(state.agents[0].currentAction).toBeUndefined();
    });
  });

  describe("file_complete deduplication", () => {
    it("should not add duplicate file to completed list", () => {
      let state = startedState();
      const event: AgentStreamEvent = {
        type: "file_complete",
        file: "src/app.ts",
        index: 0,
        total: 5,
        timestamp: ts,
      };

      state = reviewReducer(state, { type: "EVENT", event });
      state = reviewReducer(state, { type: "EVENT", event });

      expect(state.fileProgress.completed).toHaveLength(1);
      expect(state.fileProgress.completed[0]).toBe("src/app.ts");
    });
  });

  describe("updateAgents — tool_start", () => {
    it("should update agent currentAction on tool_start event", () => {
      let state = startedState();
      state = reviewReducer(state, {
        type: "EVENT",
        event: { type: "agent_start", agent: detective, timestamp: ts },
      });

      state = reviewReducer(state, {
        type: "EVENT",
        event: { type: "tool_start", agent: "detective", tool: "searchCode", input: "query", timestamp: ts },
      });

      expect(state.agents[0].currentAction).toContain("searchCode");
      expect(state.agents[0].lastToolCall).toBe("searchCode");
    });
  });

  describe("multiple concurrent agents", () => {
    it("tracks multiple agents independently", () => {
      let state = startedState();

      // Start two agents
      state = reviewReducer(state, {
        type: "EVENT",
        event: {
          type: "agent_start",
          agent: detective,
          timestamp: ts,
        },
      });
      state = reviewReducer(state, {
        type: "EVENT",
        event: {
          type: "agent_start",
          agent: guardian,
          timestamp: ts,
        },
      });

      expect(state.agents).toHaveLength(2);
      expect(state.agents[0].status).toBe("running");
      expect(state.agents[1].status).toBe("running");

      // Complete one agent
      state = reviewReducer(state, {
        type: "EVENT",
        event: { type: "agent_complete", agent: "detective", issueCount: 2, timestamp: ts },
      });

      expect(state.agents[0].status).toBe("complete");
      expect(state.agents[1].status).toBe("running");
    });
  });
});
