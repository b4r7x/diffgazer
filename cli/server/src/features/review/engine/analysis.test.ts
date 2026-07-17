import { err, ok, type Result } from "@diffgazer/core/result";
import type { AgentStreamEvent, StepEvent } from "@diffgazer/core/schemas/events";
import type { Lens, ReviewIssue } from "@diffgazer/core/schemas/review";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AIClient, AIError } from "../../../shared/lib/ai/types.js";
import { makeFileDiff, makeIssue, makeParsedDiff } from "../../../shared/lib/testing/factories.js";
import { requireValue } from "../../../testing/assertions.js";
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

  it("reports prompt coverage without claiming files were analyzed before the model responds", async () => {
    const diff = makeAnalysisDiff(2);
    const issues = [makeLensIssue("1", "file-1")];
    const response = createDeferred<Result<unknown, AIError>>();
    const client: AIClient = {
      provider: "openrouter",
      async generate(_prompt, schema) {
        const result = await response.promise;
        if (!result.ok) return result;
        return ok(schema.parse(result.value));
      },
    };
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);

    const promise = runLensAnalysis(client, CORRECTNESS_LENS, diff, onEvent);

    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain("agent_start");
    expect(eventTypes).toContain("agent_thinking");
    expect(eventTypes).toContain("agent_progress");
    expect(eventTypes).not.toContain("file_start");
    expect(eventTypes).not.toContain("file_complete");
    expect(events.filter((event) => event.type === "file_progress")).toEqual([
      expect.objectContaining({ file: "src/file-0.ts", completed: 1, total: 2 }),
      expect.objectContaining({ file: "src/file-1.ts", completed: 2, total: 2 }),
    ]);

    const messages = events
      .map((e) => {
        if ("message" in e) return e.message;
        if ("thought" in e) return e.thought;
        return "";
      })
      .join(" ");
    expect(messages).not.toMatch(
      /readFileContext|Read \d+ lines|Model analyzing patterns|Scanned \d+\/\d+ files/,
    );
    expect(messages).toMatch(/Prompt includes 2 files/);
    expect(events.at(-1)).toMatchObject({
      type: "agent_progress",
      message: "Waiting for model response",
    });
    expect(eventTypes).not.toContain("agent_complete");

    response.resolve(ok({ issues }));
    const result = await promise;

    expect(result.ok).toBe(true);
    expect(events.filter((event) => event.type === "issue_found")).toHaveLength(1);
    expect(events.map((event) => event.type)).toContain("agent_complete");

    if (result.ok) {
      expect(result.value.lensId).toBe("correctness");
      expect(result.value.issues).toHaveLength(1);
    }
  });

  it("omits unused tracing metadata from emitted events", async () => {
    const client = makeMockAIClient(ok({ issues: [] }));
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const promise = runLensAnalysis(client, CORRECTNESS_LENS, makeAnalysisDiff(), (event) =>
      events.push(event),
    );

    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event).not.toHaveProperty("traceId");
      expect(event).not.toHaveProperty("spanId");
      expect(event).not.toHaveProperty("parentSpanId");
    }
  });

  it("gates issue_found and agent_complete.issueCount on the severity threshold", async () => {
    const diff = makeAnalysisDiff(1);
    const issues = [
      makeLensIssue("blocker", "file-1", "blocker"),
      makeLensIssue("nit", "file-1", "nit"),
    ];
    const client = makeMockAIClient(ok({ issues }));
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);

    const promise = runLensAnalysis(client, CORRECTNESS_LENS, diff, onEvent, undefined, undefined, {
      minSeverity: "low",
    });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    expect(events.filter((e) => e.type === "issue_found")).toHaveLength(1);
    const complete = events.find((e) => e.type === "agent_complete");
    expect(complete && "issueCount" in complete ? complete.issueCount : -1).toBe(1);
    if (result.ok) expect(result.value.issues).toHaveLength(2);
  });

  it("drops incomplete provider issues before streaming and reports their diagnostic count", async () => {
    const complete = makeLensIssue("complete", "file-1", "medium");
    const incomplete = makeLensIssue("incomplete", "file-1", "high");
    incomplete.symptom = "";
    const client = makeMockAIClient(ok({ issues: [complete, incomplete] }));
    const events: Array<AgentStreamEvent | StepEvent> = [];

    const promise = runLensAnalysis(client, CORRECTNESS_LENS, makeAnalysisDiff(), (event) =>
      events.push(event),
    );
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.issues.map((issue) => issue.id)).toEqual(["correctness:complete"]);
    expect(result.value.droppedIncompleteProviderIssues).toBe(1);
    expect(events.filter((event) => event.type === "issue_found")).toHaveLength(1);
    expect(events.find((event) => event.type === "agent_complete")).toMatchObject({
      issueCount: 1,
    });
  });

  it("normalizes provider text and keeps only complete references from mixed evidence", async () => {
    const complete = makeLensIssue(" mixed ", " file-1 ", "medium");
    complete.title = " Visible issue ";
    complete.evidence = [
      { type: "code", title: "   ", sourceId: " source:blank ", excerpt: "   " },
      { type: "code", title: " Evidence ", sourceId: " source:valid ", excerpt: " code " },
    ];
    const whitespaceOnly = makeLensIssue("blank", "file-1", "high");
    whitespaceOnly.symptom = "   ";
    const client = makeMockAIClient(ok({ issues: [complete, whitespaceOnly] }));
    const events: Array<AgentStreamEvent | StepEvent> = [];

    const promise = runLensAnalysis(client, CORRECTNESS_LENS, makeAnalysisDiff(), (event) =>
      events.push(event),
    );
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.droppedIncompleteProviderIssues).toBe(1);
    expect(result.value.issues).toHaveLength(1);
    expect(result.value.issues[0]).toMatchObject({
      id: "correctness:mixed",
      title: "Visible issue",
      file: "src/file-0.ts",
      evidence: [{ type: "code", title: "Evidence", sourceId: "source:valid", excerpt: "code" }],
    });
    expect(events.filter((event) => event.type === "issue_found")).toHaveLength(1);
  });

  it("sanitizes terminal-escape sequences in issue free-text fields", async () => {
    const diff = makeAnalysisDiff(1);
    const malicious = makeLensIssue("evil", "file-1");
    malicious.rationale = `safe\x1b]52;c;ZXZpbA==\x07tail`;
    const client = makeMockAIClient(ok({ issues: [malicious] }));
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);

    const promise = runLensAnalysis(client, CORRECTNESS_LENS, diff, onEvent);
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
    const issues = [makeLensIssue("dupe", "file-1"), makeLensIssue("dupe", "file-1")];
    const client = makeMockAIClient(ok({ issues }));
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);

    const promise = runLensAnalysis(client, CORRECTNESS_LENS, diff, onEvent);
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
    const issue = makeLensIssue("lines", "file-1");
    issue.line_start = 0;
    issue.line_end = -5;
    const client = makeMockAIClient(ok({ issues: [issue] }));
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);

    const promise = runLensAnalysis(client, CORRECTNESS_LENS, diff, onEvent);
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.issues[0]?.line_start).toBeNull();
    expect(result.value.issues[0]?.line_end).toBeNull();
  });

  it.each([
    { code: "MODEL_ERROR", message: "Model failed" },
    { code: "RATE_LIMITED", message: "Rate limited" },
  ] as const)("propagates $code and emits it in the agent error event", async ({
    code,
    message,
  }) => {
    const diff = makeAnalysisDiff(1);
    const client = makeMockAIClient(err({ code, message }));
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);

    const promise = runLensAnalysis(client, CORRECTNESS_LENS, diff, onEvent);
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(code);
    }

    const errorEvents = events.filter((e) => e.type === "agent_error");
    expect(errorEvents).toHaveLength(1);
    const errorEvent = errorEvents[0] as Extract<AgentStreamEvent, { type: "agent_error" }>;
    expect(errorEvent.error).toContain(code);
  });

  it("backfills empty issue evidence from the diff", async () => {
    const diff = makeAnalysisDiff(1);
    const issue = makeLensIssue("1", "file-1");
    issue.evidence = [];

    const client = makeMockAIClient(ok({ issues: [issue] }));
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);

    const promise = runLensAnalysis(client, CORRECTNESS_LENS, diff, onEvent);
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (result.ok) {
      const resultIssue = requireValue(result.value.issues[0], "result issue");
      expect(resultIssue.evidence).toBeDefined();
      expect(resultIssue.evidence?.length).toBeGreaterThan(0);
    }
  });

  it("streams evidence excerpts without malformed provider ranges", async () => {
    const issue = makeLensIssue("malformed-evidence", "file-1");
    issue.evidence = [
      {
        type: "code",
        title: "negative",
        sourceId: "negative",
        range: { start: -1, end: 2 },
        excerpt: "negative excerpt",
      },
      {
        type: "code",
        title: "fractional",
        sourceId: "fractional",
        range: { start: 1.5, end: 2 },
        excerpt: "fractional excerpt",
      },
      {
        type: "code",
        title: "zero",
        sourceId: "zero",
        range: { start: 0, end: 1 },
        excerpt: "zero excerpt",
      },
      {
        type: "code",
        title: "inverted",
        sourceId: "inverted",
        range: { start: 8, end: 4 },
        excerpt: "inverted excerpt",
      },
    ];
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const client = makeMockAIClient(ok({ issues: [issue] }));

    const promise = runLensAnalysis(client, CORRECTNESS_LENS, makeAnalysisDiff(), (event) =>
      events.push(event),
    );
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    const found = events.find(
      (event): event is Extract<AgentStreamEvent, { type: "issue_found" }> =>
        event.type === "issue_found",
    );
    expect(found?.issue.evidence.map(({ range, excerpt }) => ({ range, excerpt }))).toEqual([
      { range: undefined, excerpt: "negative excerpt" },
      { range: undefined, excerpt: "fractional excerpt" },
      { range: undefined, excerpt: "zero excerpt" },
      { range: undefined, excerpt: "inverted excerpt" },
    ]);
  });

  it("backfills evidence from both hunks across the issue's full range", async () => {
    const diff = makeParsedDiff([
      makeFileDiff({
        filePath: "src/two-hunks.ts",
        hunks: [
          {
            oldStart: 2,
            oldCount: 6,
            newStart: 2,
            newCount: 6,
            content: "@@ -2,6 +2,6 @@\n first-2\n first-3\n first-4\n first-5\n first-6\n first-7",
          },
          {
            oldStart: 20,
            oldCount: 3,
            newStart: 20,
            newCount: 3,
            content: "@@ -20,3 +20,3 @@\n second-20\n second-21\n second-22",
          },
        ],
      }),
    ]);
    const issue = makeLensIssue("cross-hunk", "file-1");
    issue.line_start = 2;
    issue.line_end = 22;
    issue.evidence = [];
    const client = makeMockAIClient(ok({ issues: [issue] }));

    const promise = runLensAnalysis(client, CORRECTNESS_LENS, diff, () => {});
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const evidence = requireValue(result.value.issues[0]?.evidence?.[0], "cross-hunk evidence");
    const excerptLines = evidence.excerpt.split("\n");
    expect(excerptLines).toHaveLength(5);
    expect(excerptLines[0]).toBe("first-2");
    expect(excerptLines).toContain("second-20");
    expect(excerptLines.filter((line) => line === "... [evidence gap] ...")).toHaveLength(1);
    expect(evidence.range).toEqual({ start: 2, end: 22 });
    expect(evidence.sourceId).toBe("src/two-hunks.ts:2-22");
  });

  it("maps opaque file ids back to exact control-bearing Git paths", async () => {
    const rawPaths = ["dir\tname.ts", "dirname.ts", "line\nbreak.ts"];
    const diff = makeParsedDiff(rawPaths.map((filePath) => ({ filePath })));
    const issues = rawPaths.map((_filePath, index) =>
      makeLensIssue(`mapped-${index + 1}`, `file-${index + 1}`),
    );
    for (const [index, issue] of issues.entries()) {
      issue.fixPlan = [
        {
          step: 1,
          action: "Fix the mapped file",
          files: [`file-${index + 1}`],
          risk: "low",
        },
      ];
      issue.evidence = [
        {
          type: "code",
          title: "Mapped evidence",
          sourceId: `evidence-${index + 1}`,
          file: `file-${index + 1}`,
          excerpt: "changed line",
        },
      ];
    }
    const client = makeMockAIClient(ok({ issues }));

    const promise = runLensAnalysis(client, CORRECTNESS_LENS, diff, () => {});
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.issues.map((issue) => issue.file)).toEqual(rawPaths);
    expect(result.value.issues.map((issue) => issue.evidence[0]?.file)).toEqual(rawPaths);
    expect(result.value.issues.map((issue) => issue.fixPlan?.[0]?.files?.[0])).toEqual(rawPaths);
  });

  it.each([
    {
      reference: "issue file",
      addUnknownReference: (issue: ReviewIssue) => {
        issue.file = "file-unknown";
      },
    },
    {
      reference: "evidence file",
      addUnknownReference: (issue: ReviewIssue) => {
        issue.evidence = [
          {
            type: "code",
            title: "Unknown evidence identity",
            sourceId: "unknown-evidence",
            file: "file-unknown",
            excerpt: "not trusted",
          },
        ];
      },
    },
    {
      reference: "fix-plan file",
      addUnknownReference: (issue: ReviewIssue) => {
        issue.fixPlan = [
          { step: 1, action: "Edit an unknown file", files: ["file-unknown"], risk: "low" },
        ];
      },
    },
  ])("rejects an unknown opaque $reference identity", async ({ addUnknownReference }) => {
    const diff = makeAnalysisDiff(1);
    const issue = makeLensIssue("1", "file-1");
    addUnknownReference(issue);
    const client = makeMockAIClient(ok({ issues: [issue] }));
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);

    const promise = runLensAnalysis(client, CORRECTNESS_LENS, diff, onEvent);
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PARSE_ERROR");
    expect(events.filter((event) => event.type === "issue_found")).toHaveLength(0);
    expect(events.filter((event) => event.type === "agent_error")).toHaveLength(1);
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

    const promise = runLensAnalysis(client, CORRECTNESS_LENS, diff, onEvent);

    await expect(promise).rejects.toThrow("Network failure");

    const eventCountBefore = events.filter((e) => e.type === "agent_progress").length;
    await vi.advanceTimersByTimeAsync(15000);
    const eventCountAfter = events.filter((e) => e.type === "agent_progress").length;
    expect(eventCountAfter).toBe(eventCountBefore);
  });
});
