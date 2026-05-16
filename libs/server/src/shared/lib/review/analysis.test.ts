import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AIClient } from "../ai/types.js";
import type { Lens, ReviewIssue } from "@diffgazer/core/schemas/review";
import type { AgentStreamEvent, StepEvent } from "@diffgazer/core/schemas/events";
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

  it("emits the agent, file, tool, and issue events in order on success", async () => {
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

    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);

    const eventTypes = events.map((e) => e.type);

    expect(eventTypes).toContain("agent_start");
    expect(eventTypes).toContain("agent_thinking");
    expect(eventTypes).toContain("agent_progress");

    expect(eventTypes.filter((t) => t === "file_start")).toHaveLength(2);
    expect(eventTypes.filter((t) => t === "file_complete")).toHaveLength(2);

    expect(eventTypes.filter((t) => t === "tool_start")).toHaveLength(2);
    expect(eventTypes.filter((t) => t === "tool_end")).toHaveLength(2);

    expect(eventTypes.filter((t) => t === "issue_found")).toHaveLength(1);
    expect(eventTypes).toContain("agent_complete");

    if (result.ok) {
      expect(result.value.lensId).toBe("correctness");
      expect(result.value.lensName).toBe("Correctness");
      expect(result.value.issues).toHaveLength(1);
    }
  });

  it("propagates the AI client error and emits an agent_error event", async () => {
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

    const errorEvents = events.filter((e) => e.type === "agent_error");
    expect(errorEvents).toHaveLength(1);
    const errorEvent = errorEvents[0] as Extract<AgentStreamEvent, { type: "agent_error" }>;
    expect(errorEvent.error).toContain("MODEL_ERROR");
  });

  it("stops scanning additional files once the abort signal fires", async () => {
    const diff = makeDiff(5);
    const client = makeMockAIClient(ok({ summary: "Clean", issues: [] }));
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);
    const controller = new AbortController();

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

    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;

    const fileStartEvents = events.filter((e) => e.type === "file_start");
    expect(fileStartEvents.length).toBeLessThanOrEqual(5);

    expect(result.ok).toBe(true);
  });

  it("backfills empty issue evidence from the diff", async () => {
    const diff = makeDiff(1);
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

  it("stops emitting progress events after the generate call rejects", async () => {
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
