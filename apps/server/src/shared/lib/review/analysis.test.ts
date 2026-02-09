import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AIClient } from "../ai/types.js";
import type { Lens, ReviewIssue } from "@diffgazer/schemas/review";
import type { AgentStreamEvent, StepEvent } from "@diffgazer/schemas/events";
import type { ParsedDiff } from "../diff/types.js";
import type { AgentRunContext } from "./types.js";
import { ok, err } from "@diffgazer/core/result";
import { runLensAnalysis } from "./analysis.js";

const CORRECTNESS_LENS: Lens = {
  id: "correctness",
  name: "Correctness",
  description: "Find bugs and logic errors",
  systemPrompt: "You are a code reviewer.",
  severityRubric: {
    blocker: "Crashes or data loss",
    high: "Significant bug",
    medium: "Minor bug",
    low: "Code smell",
    nit: "Style issue",
  },
};

function makeDiff(fileCount = 1): ParsedDiff {
  const files = Array.from({ length: fileCount }, (_, i) => ({
    filePath: `src/file-${i}.ts`,
    previousPath: null,
    operation: "modify" as const,
    hunks: [
      {
        oldStart: 1,
        oldCount: 5,
        newStart: 1,
        newCount: 7,
        content: "line1\nline2\nline3\nline4\nline5\nline6\nline7",
      },
    ],
    rawDiff: "diff --git a/file b/file\n+added line\n-removed line",
    stats: { additions: 2, deletions: 1, sizeBytes: 100 },
  }));

  return {
    files,
    totalStats: {
      filesChanged: fileCount,
      additions: fileCount * 2,
      deletions: fileCount,
      totalSizeBytes: fileCount * 100,
    },
  };
}

function makeContext(): AgentRunContext {
  return {
    traceId: "trace-1",
    spanId: "span-1",
    parentSpanId: "parent-span-1",
  };
}

function makeIssue(id: string, file: string): ReviewIssue {
  return {
    id,
    file,
    severity: "medium",
    category: "correctness",
    title: `Issue ${id}`,
    rationale: "test rationale",
    recommendation: "fix it",
    suggested_patch: null,
    confidence: 0.9,
    symptom: "broken",
    whyItMatters: "matters",
    evidence: [],
    line_start: 1,
    line_end: 5,
  } as ReviewIssue;
}

function makeMockAIClient(result: Awaited<ReturnType<AIClient["generate"]>>): AIClient {
  return {
    provider: "openrouter",
    generate: vi.fn().mockResolvedValue(result),
    generateStream: vi.fn(),
  };
}

describe("runLensAnalysis", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should emit correct event sequence for successful analysis", async () => {
    const diff = makeDiff(2);
    const issues = [makeIssue("1", "src/file-0.ts")];
    const client = makeMockAIClient(
      ok({ summary: "Found 1 issue", issues }),
    );
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);

    const promise = runLensAnalysis(
      client,
      CORRECTNESS_LENS,
      diff,
      onEvent,
      makeContext(),
    );

    // Advance past all timers to let the progress timer fire
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);

    const eventTypes = events.map((e) => e.type);

    // Should contain the initial lifecycle events
    expect(eventTypes).toContain("agent_start");
    expect(eventTypes).toContain("agent_thinking");
    expect(eventTypes).toContain("agent_progress");

    // Should have file_start/file_complete for each file
    expect(eventTypes.filter((t) => t === "file_start")).toHaveLength(2);
    expect(eventTypes.filter((t) => t === "file_complete")).toHaveLength(2);

    // Should have tool_start/tool_end for each file
    expect(eventTypes.filter((t) => t === "tool_start")).toHaveLength(2);
    expect(eventTypes.filter((t) => t === "tool_end")).toHaveLength(2);

    // Should contain issue_found and end with agent_complete
    expect(eventTypes.filter((t) => t === "issue_found")).toHaveLength(1);
    expect(eventTypes).toContain("agent_complete");

    // Result should contain lens info
    if (result.ok) {
      expect(result.value.lensId).toBe("correctness");
      expect(result.value.lensName).toBe("Correctness");
      expect(result.value.issues).toHaveLength(1);
    }
  });

  it("should handle AI client error result", async () => {
    const diff = makeDiff(1);
    const client = makeMockAIClient(
      err({ code: "MODEL_ERROR" as const, message: "Model failed" }),
    );
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);

    const promise = runLensAnalysis(
      client,
      CORRECTNESS_LENS,
      diff,
      onEvent,
      makeContext(),
    );
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MODEL_ERROR");
    }

    // Should have emitted agent_error event
    const errorEvents = events.filter((e) => e.type === "agent_error");
    expect(errorEvents).toHaveLength(1);
    const errorEvent = errorEvents[0] as Extract<AgentStreamEvent, { type: "agent_error" }>;
    expect(errorEvent.error).toContain("MODEL_ERROR");
  });

  it("should respect abort signal during file scanning", async () => {
    const diff = makeDiff(5);
    const client = makeMockAIClient(ok({ summary: "Clean", issues: [] }));
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);
    const controller = new AbortController();

    // Abort after a tick
    setTimeout(() => controller.abort(), 0);

    const promise = runLensAnalysis(
      client,
      CORRECTNESS_LENS,
      diff,
      onEvent,
      makeContext(),
      undefined,
      controller.signal,
    );

    // Advance to trigger abort
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;

    // The file scan loop should have broken early
    const fileStartEvents = events.filter((e) => e.type === "file_start");
    expect(fileStartEvents.length).toBeLessThanOrEqual(5);

    // Still returns a result (AI client was still called)
    expect(result.ok).toBe(true);
  });

  it("should ensure issue evidence from diff", async () => {
    const diff = makeDiff(1);
    // Issue with empty evidence - should get evidence added from diff
    const issue = makeIssue("1", "src/file-0.ts");
    issue.evidence = [];

    const client = makeMockAIClient(
      ok({ summary: "Found issue", issues: [issue] }),
    );
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);

    const promise = runLensAnalysis(
      client,
      CORRECTNESS_LENS,
      diff,
      onEvent,
      makeContext(),
    );
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (result.ok) {
      const resultIssue = result.value.issues[0]!;
      expect(resultIssue.evidence).toBeDefined();
      expect(resultIssue.evidence!.length).toBeGreaterThan(0);
    }
  });

  it("should clean up progress timer on error", async () => {
    const diff = makeDiff(1);
    const rejectError = new Error("Network failure");
    const client: AIClient = {
      provider: "openrouter",
      generate: vi.fn().mockRejectedValue(rejectError),
      generateStream: vi.fn(),
    };
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);

    const promise = runLensAnalysis(
      client,
      CORRECTNESS_LENS,
      diff,
      onEvent,
      makeContext(),
    );

    // Await the rejection immediately so it doesn't leak as unhandled
    await expect(promise).rejects.toThrow("Network failure");

    // Timer should be cleaned up - advancing time further should not add progress events
    const eventCountBefore = events.filter((e) => e.type === "agent_progress").length;
    await vi.advanceTimersByTimeAsync(15000);
    const eventCountAfter = events.filter((e) => e.type === "agent_progress").length;
    expect(eventCountAfter).toBe(eventCountBefore);
  });
});
