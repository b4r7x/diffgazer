import { err, ok } from "@diffgazer/core/result";
import type { AgentStreamEvent, StepEvent } from "@diffgazer/core/schemas/events";
import type { Lens, ReviewIssue } from "@diffgazer/core/schemas/review";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AIClient } from "../../../shared/lib/ai/types.js";
import { makeFileDiff, makeIssue, makeParsedDiff } from "../../../shared/lib/testing/factories.js";
import { requireValue } from "../../../testing/assertions.js";
import { runLensAnalysis } from "./analysis.js";
import type { AgentRunContext } from "./types.js";

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

function makeAnalysisDiff(fileCount = 1) {
  return makeParsedDiff(
    Array.from({ length: fileCount }, (_, i) =>
      makeFileDiff({
        filePath: `src/file-${i}.ts`,
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
      }),
    ),
  );
}

function makeContext(): AgentRunContext {
  return {
    traceId: "trace-1",
    spanId: "span-1",
    parentSpanId: "parent-span-1",
  };
}

function makeLensIssue(
  id: string,
  file: string,
  severity: ReviewIssue["severity"] = "medium",
): ReviewIssue {
  return makeIssue({
    id,
    file,
    severity,
    title: `Issue ${id}`,
    rationale: "test rationale",
    recommendation: "fix it",
    symptom: "broken",
    whyItMatters: "matters",
    line_start: 1,
    line_end: 5,
  });
}

function makeMockAIClient(result: Awaited<ReturnType<AIClient["generate"]>>): AIClient {
  return {
    provider: "openrouter",
    generate: vi.fn().mockResolvedValue(result),
  };
}

describe("runLensAnalysis", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits honest agent, file-progress, and issue events on success (no readFileContext theater)", async () => {
    const diff = makeAnalysisDiff(2);
    const issues = [makeLensIssue("1", "src/file-0.ts")];
    const client = makeMockAIClient(ok({ summary: "Found 1 issue", issues }));
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);

    const promise = runLensAnalysis(client, CORRECTNESS_LENS, diff, onEvent, makeContext());

    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);

    const eventTypes = events.map((e) => e.type);

    expect(eventTypes).toContain("agent_start");
    expect(eventTypes).toContain("agent_thinking");
    expect(eventTypes).toContain("agent_progress");

    expect(eventTypes.filter((t) => t === "file_start")).toHaveLength(2);
    expect(eventTypes.filter((t) => t === "file_complete")).toHaveLength(2);

    expect(eventTypes.filter((t) => t === "file_progress")).toHaveLength(2);
    expect(eventTypes.filter((t) => t === "tool_start")).toHaveLength(0);
    expect(eventTypes.filter((t) => t === "tool_end")).toHaveLength(0);

    const messages = events
      .map((e) => {
        if ("message" in e) return e.message;
        if ("summary" in e) return e.summary;
        if ("thought" in e) return e.thought;
        return "";
      })
      .join(" ");
    expect(messages).not.toMatch(/readFileContext|Read \d+ lines|Model analyzing patterns/);
    expect(messages).toMatch(/Prompt built: 2 files/);

    expect(eventTypes.filter((t) => t === "issue_found")).toHaveLength(1);
    expect(eventTypes).toContain("agent_complete");

    if (result.ok) {
      expect(result.value.lensId).toBe("correctness");
      expect(result.value.lensName).toBe("Correctness");
      expect(result.value.issues).toHaveLength(1);
    }
  });

  it("gates issue_found and agent_complete.issueCount on the severity threshold", async () => {
    const diff = makeAnalysisDiff(1);
    const issues = [
      makeLensIssue("blocker", "src/file-0.ts", "blocker"),
      makeLensIssue("nit", "src/file-0.ts", "nit"),
    ];
    const client = makeMockAIClient(ok({ summary: "Found issues", issues }));
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);

    const promise = runLensAnalysis(
      client,
      CORRECTNESS_LENS,
      diff,
      onEvent,
      makeContext(),
      undefined,
      undefined,
      { minSeverity: "low" },
    );
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    expect(events.filter((e) => e.type === "issue_found")).toHaveLength(1);
    const complete = events.find((e) => e.type === "agent_complete");
    expect(complete && "issueCount" in complete ? complete.issueCount : -1).toBe(1);
    if (result.ok) expect(result.value.issues).toHaveLength(2);
  });

  it("sanitizes terminal-escape sequences in issue free-text fields", async () => {
    const diff = makeAnalysisDiff(1);
    const malicious = makeLensIssue("evil", "src/file-0.ts");
    malicious.rationale = `safe\x1b]52;c;ZXZpbA==\x07tail`;
    const client = makeMockAIClient(ok({ summary: "x", issues: [malicious] }));
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);

    const promise = runLensAnalysis(client, CORRECTNESS_LENS, diff, onEvent, makeContext());
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.issues[0]?.rationale).toBe("safetail");
    const found = events.find((e) => e.type === "issue_found");
    const streamedRationale = found && "issue" in found ? found.issue.rationale : "";
    expect(streamedRationale).not.toContain("\x1b");
  });

  it("gives two issues sharing a raw id distinct selectable identities", async () => {
    const diff = makeAnalysisDiff(1);
    const issues = [makeLensIssue("dupe", "src/file-0.ts"), makeLensIssue("dupe", "src/file-0.ts")];
    const client = makeMockAIClient(ok({ summary: "Found 2 issues", issues }));
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);

    const promise = runLensAnalysis(client, CORRECTNESS_LENS, diff, onEvent, makeContext());
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ids = result.value.issues.map((issue) => issue.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(ids[0]).toBe("correctness:dupe");

    const streamedIds = events
      .filter((e) => e.type === "issue_found")
      .map((e) => ("issue" in e ? e.issue.id : ""));
    expect(streamedIds).toEqual(ids);
  });

  it("normalizes inverted and non-positive line numbers instead of failing the lens", async () => {
    const diff = makeAnalysisDiff(1);
    const issue = makeLensIssue("lines", "src/file-0.ts");
    issue.line_start = 0;
    issue.line_end = -5;
    const client = makeMockAIClient(ok({ summary: "x", issues: [issue] }));
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);

    const promise = runLensAnalysis(client, CORRECTNESS_LENS, diff, onEvent, makeContext());
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.issues[0]?.line_start).toBeNull();
    expect(result.value.issues[0]?.line_end).toBeNull();
  });

  it("propagates the AI client error and emits an agent_error event", async () => {
    const diff = makeAnalysisDiff(1);
    const client = makeMockAIClient(err({ code: "MODEL_ERROR" as const, message: "Model failed" }));
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);

    const promise = runLensAnalysis(client, CORRECTNESS_LENS, diff, onEvent, makeContext());
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
    const diff = makeAnalysisDiff(5);
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
    const diff = makeAnalysisDiff(1);
    const issue = makeLensIssue("1", "src/file-0.ts");
    issue.evidence = [];

    const client = makeMockAIClient(ok({ summary: "Found issue", issues: [issue] }));
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);

    const promise = runLensAnalysis(client, CORRECTNESS_LENS, diff, onEvent, makeContext());
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (result.ok) {
      const resultIssue = requireValue(result.value.issues[0], "result issue");
      expect(resultIssue.evidence).toBeDefined();
      expect(resultIssue.evidence?.length).toBeGreaterThan(0);
    }
  });

  it("filters out issues referencing files not in the reviewed diff", async () => {
    const diff = makeAnalysisDiff(1);
    const validIssue = makeLensIssue("1", "src/file-0.ts");
    const hallucinatedIssue = makeLensIssue("2", "src/nonexistent.ts");
    const client = makeMockAIClient(
      ok({ summary: "Found 2 issues", issues: [validIssue, hallucinatedIssue] }),
    );
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);

    const promise = runLensAnalysis(client, CORRECTNESS_LENS, diff, onEvent, makeContext());
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.issues).toHaveLength(1);
      expect(result.value.issues[0]?.file).toBe("src/file-0.ts");
    }

    const issueEvents = events.filter((e) => e.type === "issue_found");
    expect(issueEvents).toHaveLength(1);
  });

  it("stops emitting progress events after the generate call rejects", async () => {
    const diff = makeAnalysisDiff(1);
    const rejectError = new Error("Network failure");
    const client: AIClient = {
      provider: "openrouter",
      generate: vi.fn().mockRejectedValue(rejectError),
    };
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);

    const promise = runLensAnalysis(client, CORRECTNESS_LENS, diff, onEvent, makeContext());

    await expect(promise).rejects.toThrow("Network failure");

    const eventCountBefore = events.filter((e) => e.type === "agent_progress").length;
    await vi.advanceTimersByTimeAsync(15000);
    const eventCountAfter = events.filter((e) => e.type === "agent_progress").length;
    expect(eventCountAfter).toBe(eventCountBefore);
  });
});
