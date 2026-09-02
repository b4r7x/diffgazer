import { canonicalJson } from "@diffgazer/core/json";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { AgentStreamEvent, StepEvent } from "@diffgazer/core/schemas/events";
import type { Lens, ReviewIssue, SeverityFilter } from "@diffgazer/core/schemas/review";
import { MAX_REVIEW_ISSUES_PER_LENS } from "@diffgazer/core/schemas/review";
import { requireValue } from "@diffgazer/core/testing/assertions";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AIClient, AIError, GenerateWarning } from "../../../shared/lib/ai/types.js";
import { makeFileDiff, makeParsedDiff } from "../testing/factories.js";
import { runLensAnalysis, runSynthesisAnalysis } from "./analysis.js";
import type { ParsedDiff } from "./diff/types.js";

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

function makeAnalysisFile(filePath: string) {
  return makeFileDiff({
    filePath,
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
  });
}

function makeAnalysisDiff(fileCount = 1) {
  return makeParsedDiff(
    Array.from({ length: fileCount }, (_, i) => makeAnalysisFile(`src/file-${i}.ts`)),
  );
}

function makeBatchDiff(filePath: string): ParsedDiff {
  return makeParsedDiff([makeAnalysisFile(filePath)]);
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

type MockGenerateResult = Result<{ issues: ReviewIssue[]; warning?: GenerateWarning }, AIError>;

function makeSequencedAIClient(results: MockGenerateResult[]): {
  client: AIClient;
  calls: () => number;
} {
  let callCount = 0;
  const client: AIClient = {
    provider: "openrouter",
    async generate(_prompt, schema) {
      const result = results[callCount];
      callCount += 1;
      if (result === undefined) throw new Error("unexpected extra batch dispatch");
      if (!result.ok) return result;
      const { warning, ...payload } = result.value;
      return ok({ data: schema.parse(payload), ...(warning && { warning }) });
    },
  };
  return { client, calls: () => callCount };
}

function dispatchFailure(code: string, retryable: boolean): Result<never, AIError> {
  const message = `${code} failure`;
  return err({
    code: "STREAM_ERROR",
    message,
    diagnostic: {
      code,
      safeMessage: message,
      retryable,
      remediation: "Retry.",
      correlationId: `corr-${code}`,
    },
  });
}

function allPaths(batches: readonly ParsedDiff[]): string[] {
  return batches.flatMap((batch) => batch.files.map((file) => file.filePath));
}

function runSingleBatchLens(
  client: AIClient,
  diff: ParsedDiff,
  onEvent: (event: AgentStreamEvent | StepEvent) => void = () => {},
  severityFilter?: SeverityFilter,
) {
  return runLensAnalysis({
    client,
    lens: CORRECTNESS_LENS,
    batches: [diff],
    allChangedFilePaths: allPaths([diff]),
    onEvent,
    severityFilter,
  });
}

function makeMockAIClient(result: MockGenerateResult): AIClient {
  return {
    provider: "openrouter",
    // The production bridge parses every adapter response through the caller's
    // schema, so the double must too — analysis never sees raw provider output.
    async generate(_prompt, schema) {
      if (!result.ok) return result;
      const { warning, ...payload } = result.value;
      return ok({ data: schema.parse(payload), ...(warning && { warning }) });
    },
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
        return ok({ data: schema.parse(result.value) });
      },
    };
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);

    const promise = runSingleBatchLens(client, diff, onEvent);

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

  it("gates issue_found and agent_complete.issueCount on the severity threshold", async () => {
    const diff = makeAnalysisDiff(1);
    const issues = [
      makeLensIssue("blocker", "file-1", "blocker"),
      makeLensIssue("nit", "file-1", "nit"),
    ];
    const client = makeMockAIClient(ok({ issues }));
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);

    const promise = runSingleBatchLens(client, diff, onEvent, { minSeverity: "low" });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    expect(events.filter((e) => e.type === "issue_found")).toHaveLength(1);
    const complete = events.find((e) => e.type === "agent_complete");
    expect(complete && "issueCount" in complete ? complete.issueCount : -1).toBe(1);
    if (result.ok) expect(result.value.issues).toHaveLength(2);
  });

  it("normalizes provider text and keeps only complete references from mixed evidence", async () => {
    const complete = makeLensIssue(" mixed ", " file-1 ", "medium");
    complete.title = " Visible issue ";
    complete.evidence = [
      { type: "doc", title: "   ", sourceId: " source:blank ", excerpt: "   " },
      { type: "doc", title: " Evidence ", sourceId: " source:valid ", excerpt: " code " },
    ];
    const whitespaceOnly = makeLensIssue("blank", "file-1", "high");
    whitespaceOnly.symptom = "   ";
    const client = makeMockAIClient(ok({ issues: [complete, whitespaceOnly] }));
    const events: Array<AgentStreamEvent | StepEvent> = [];

    const promise = runSingleBatchLens(client, makeAnalysisDiff(), (event) => events.push(event));
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
      // Code evidence is always the server's own diff extraction; only complete
      // non-code provider references survive beside it.
      evidence: [
        { type: "code", file: "src/file-0.ts", sourceId: "src/file-0.ts:1-5" },
        // An excerpt keeps its leading indentation (it is verbatim source); only
        // trailing whitespace and blank padding lines are normalized away.
        { type: "doc", title: "Evidence", sourceId: "source:valid", excerpt: " code" },
      ],
    });
    expect(events.filter((event) => event.type === "issue_found")).toHaveLength(1);
    expect(events.find((event) => event.type === "agent_complete")).toMatchObject({
      issueCount: 1,
    });
  });

  it("returns issues canonical JSON accepts when the provider omits optional fields", async () => {
    const diff = makeAnalysisDiff(1);
    const client = makeMockAIClient(ok({ issues: [makeLensIssue("plain", "file-1")] }));

    const promise = runSingleBatchLens(client, diff);
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const issue = requireValue(result.value.issues[0], "normalized issue");
    for (const field of ["betterOptions", "testsToAdd", "fixPlan", "trace"] as const) {
      expect(issue).not.toHaveProperty(field);
    }
    // Saving a completed review compares the canonical JSON of these issues
    // against the execution result, and canonical JSON rejects undefined values.
    expect(() => canonicalJson(result.value.issues)).not.toThrow();
  });

  it("sanitizes terminal-escape sequences in issue free-text fields", async () => {
    const diff = makeAnalysisDiff(1);
    const malicious = makeLensIssue("evil", "file-1");
    malicious.rationale = `safe\x1b]52;c;ZXZpbA==\x07tail`;
    const client = makeMockAIClient(ok({ issues: [malicious] }));
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);

    const promise = runSingleBatchLens(client, diff, onEvent);
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

    const promise = runSingleBatchLens(client, diff, onEvent);
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

    const promise = runSingleBatchLens(client, diff, onEvent);
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

    const promise = runSingleBatchLens(client, diff, onEvent);
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
    expect(events.filter((event) => event.type === "agent_complete")).toHaveLength(0);
  });

  it("streams diff-extracted evidence instead of malformed provider ranges", async () => {
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

    const promise = runSingleBatchLens(client, makeAnalysisDiff(), (event) => events.push(event));
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    const found = events.find(
      (event): event is Extract<AgentStreamEvent, { type: "issue_found" }> =>
        event.type === "issue_found",
    );
    expect(found?.issue.evidence).toEqual([
      {
        type: "code",
        title: "Code at src/file-0.ts:1",
        sourceId: "src/file-0.ts:1-5",
        file: "src/file-0.ts",
        range: { start: 1, end: 5 },
        excerpt: "line1\nline2\nline3\nline4\nline5",
        excerptLineNumbers: [1, 2, 3, 4, 5],
      },
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

    const promise = runSingleBatchLens(client, diff);
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const evidence = requireValue(result.value.issues[0]?.evidence?.[0], "cross-hunk evidence");
    const excerptLines = evidence.excerpt.split("\n");
    expect(excerptLines).toHaveLength(10);
    expect(excerptLines[0]).toBe("first-2");
    expect(excerptLines).toContain("second-20");
    expect(excerptLines.filter((line) => line === "... [evidence gap] ...")).toHaveLength(1);
    expect(evidence.range).toEqual({ start: 2, end: 22 });
    expect(evidence.sourceId).toBe("src/two-hunks.ts:2-22");
    expect(evidence.excerptLineNumbers).toEqual([2, 3, 4, 5, 6, 7, null, 20, 21, 22]);
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

    const promise = runSingleBatchLens(client, diff);
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
  ])("drops an unknown opaque $reference identity without failing the lens", async ({
    addUnknownReference,
  }) => {
    const diff = makeAnalysisDiff(1);
    const issue = makeLensIssue("1", "file-1");
    addUnknownReference(issue);
    const client = makeMockAIClient(ok({ issues: [issue] }));
    const events: Array<AgentStreamEvent | StepEvent> = [];
    const onEvent = (e: AgentStreamEvent | StepEvent) => events.push(e);

    const promise = runSingleBatchLens(client, diff, onEvent);
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.issues).toHaveLength(0);
    expect(result.value.droppedIncompleteProviderIssues).toBe(1);
    expect(events.filter((event) => event.type === "issue_found")).toHaveLength(0);
    expect(events.filter((event) => event.type === "agent_error")).toHaveLength(0);
    expect(events.filter((event) => event.type === "agent_complete")).toHaveLength(1);
  });

  it("resolves each batch's opaque ids against its own files and merges the results", async () => {
    const batches = [makeBatchDiff("src/one.ts"), makeBatchDiff("src/two.ts")];
    const client = makeSequencedAIClient([
      ok({ issues: [makeLensIssue("dupe", "file-1")] }),
      ok({ issues: [makeLensIssue("dupe", "file-1")] }),
    ]);
    const events: Array<AgentStreamEvent | StepEvent> = [];

    const promise = runLensAnalysis({
      client: client.client,
      lens: CORRECTNESS_LENS,
      batches,
      allChangedFilePaths: allPaths(batches),
      onEvent: (event) => events.push(event),
    });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.issues.map((issue) => issue.file)).toEqual(["src/one.ts", "src/two.ts"]);
    const ids = result.value.issues.map((issue) => issue.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids).toEqual(["correctness:dupe", "correctness:dupe#2"]);

    expect(events.filter((event) => event.type === "agent_start")).toHaveLength(1);
    expect(events.filter((event) => event.type === "agent_complete")).toHaveLength(1);
    const messages = events.map((event) => ("message" in event ? (event.message ?? "") : ""));
    expect(messages.some((message) => message.includes("(batch 1/2)"))).toBe(true);
    expect(messages.some((message) => message.includes("(batch 2/2)"))).toBe(true);
  });

  it("caps concatenated batch issues at the per-lens maximum, keeping the highest severities", async () => {
    const batches = [makeBatchDiff("src/one.ts"), makeBatchDiff("src/two.ts")];
    const client = makeSequencedAIClient([
      ok({
        issues: Array.from({ length: MAX_REVIEW_ISSUES_PER_LENS }, (_, index) =>
          makeLensIssue(`low-${index}`, "file-1", "low"),
        ),
      }),
      ok({
        issues: Array.from({ length: 10 }, (_, index) =>
          makeLensIssue(`blocker-${index}`, "file-1", "blocker"),
        ),
      }),
    ]);

    const promise = runLensAnalysis({
      client: client.client,
      lens: CORRECTNESS_LENS,
      batches,
      allChangedFilePaths: allPaths(batches),
      onEvent: () => {},
    });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.issues).toHaveLength(MAX_REVIEW_ISSUES_PER_LENS);
    // Every blocker from the second batch survives; the overflow comes off the lows.
    expect(result.value.issues.filter((issue) => issue.severity === "blocker")).toHaveLength(10);
    expect(result.value.issues.filter((issue) => issue.file === "src/two.ts")).toHaveLength(10);
    expect(new Set(result.value.issues.map((issue) => issue.id)).size).toBe(
      MAX_REVIEW_ISSUES_PER_LENS,
    );
  });

  it("sums droppedCandidateCount across salvaged batches", async () => {
    const batches = [makeBatchDiff("src/one.ts"), makeBatchDiff("src/two.ts")];
    const client = makeSequencedAIClient([
      ok({
        issues: [makeLensIssue("kept", "file-1")],
        warning: { droppedCandidateCount: 3 },
      }),
      ok({
        issues: [],
        warning: { droppedCandidateCount: 4 },
      }),
    ]);

    const promise = runLensAnalysis({
      client: client.client,
      lens: CORRECTNESS_LENS,
      batches,
      allChangedFilePaths: allPaths(batches),
      onEvent: () => {},
    });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.droppedCandidateCount).toBe(7);
    expect(result.value.issues).toHaveLength(1);
  });

  it("reports droppedCandidateCount 0 when every answer arrives whole", async () => {
    const client = makeMockAIClient(ok({ issues: [makeLensIssue("whole", "file-1")] }));

    const promise = runSingleBatchLens(client, makeAnalysisDiff(1));
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.droppedCandidateCount).toBe(0);
  });

  it("records one dispatch entry per batch with completed outcomes", async () => {
    const batches = [makeBatchDiff("src/one.ts"), makeBatchDiff("src/two.ts")];
    const client = makeSequencedAIClient([ok({ issues: [] }), ok({ issues: [] })]);

    const promise = runLensAnalysis({
      client: client.client,
      lens: CORRECTNESS_LENS,
      batches,
      allChangedFilePaths: allPaths(batches),
      onEvent: () => {},
    });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.dispatches).toHaveLength(2);
    for (const [index, dispatch] of result.value.dispatches.entries()) {
      expect(dispatch.batchIndex).toBe(index);
      expect(dispatch.outcome).toBe("completed");
      expect(Date.parse(dispatch.startedAt)).not.toBeNaN();
      expect(Date.parse(dispatch.finishedAt)).toBeGreaterThanOrEqual(
        Date.parse(dispatch.startedAt),
      );
    }
  });

  it("records the failing batch's dispatch entry with its error code", async () => {
    const batches = [makeBatchDiff("src/one.ts"), makeBatchDiff("src/two.ts")];
    const client = makeSequencedAIClient([
      ok({ issues: [makeLensIssue("kept", "file-1", "high")] }),
      err({ code: "MODEL_ERROR", message: "Model failed" }),
    ]);

    const promise = runLensAnalysis({
      client: client.client,
      lens: CORRECTNESS_LENS,
      batches,
      allChangedFilePaths: allPaths(batches),
      onEvent: () => {},
    });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.dispatches.map((dispatch) => dispatch.outcome)).toEqual([
      "completed",
      "MODEL_ERROR",
    ]);
    expect(result.value.dispatches[1]?.batchIndex).toBe(1);
  });

  it("stops dispatching batches once one of them fails non-retryably", async () => {
    const batches = [makeBatchDiff("src/one.ts"), makeBatchDiff("src/two.ts")];
    const client = makeSequencedAIClient([
      err({ code: "MODEL_ERROR", message: "Model failed" }),
      ok({ issues: [] }),
    ]);
    const events: Array<AgentStreamEvent | StepEvent> = [];

    const promise = runLensAnalysis({
      client: client.client,
      lens: CORRECTNESS_LENS,
      batches,
      allChangedFilePaths: allPaths(batches),
      onEvent: (event) => events.push(event),
    });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.dispatches).toEqual([
      expect.objectContaining({ batchIndex: 0, outcome: "MODEL_ERROR" }),
    ]);
    expect(client.calls()).toBe(1);
    expect(events.filter((event) => event.type === "agent_error")).toHaveLength(1);
    expect(events.filter((event) => event.type === "agent_complete")).toHaveLength(0);
  });

  it("keeps the earlier batches' findings when a later batch fails", async () => {
    const batches = [makeBatchDiff("src/one.ts"), makeBatchDiff("src/two.ts")];
    const client = makeSequencedAIClient([
      ok({ issues: [makeLensIssue("kept", "file-1", "high")] }),
      err({ code: "MODEL_ERROR", message: "Model failed" }),
    ]);
    const events: Array<AgentStreamEvent | StepEvent> = [];

    const promise = runLensAnalysis({
      client: client.client,
      lens: CORRECTNESS_LENS,
      batches,
      allChangedFilePaths: allPaths(batches),
      onEvent: (event) => events.push(event),
    });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.issues.map((issue) => issue.file)).toEqual(["src/one.ts"]);
    expect(result.value.batchError).toEqual({ code: "MODEL_ERROR", message: "Model failed" });
    expect(client.calls()).toBe(2);
    expect(events.filter((event) => event.type === "agent_complete")).toHaveLength(1);
  });

  function makeRequeueScenario() {
    const batches = [
      makeBatchDiff("src/one.ts"),
      makeBatchDiff("src/two.ts"),
      makeBatchDiff("src/three.ts"),
    ];
    const client = makeSequencedAIClient([
      dispatchFailure("provider-rejected", true),
      ok({ issues: [makeLensIssue("two", "file-1")] }),
      ok({ issues: [makeLensIssue("three", "file-1")] }),
      ok({ issues: [makeLensIssue("one", "file-1")] }),
    ]);
    return { batches, client };
  }

  it("re-queues a retryably failed batch after the remaining batches", async () => {
    const { batches, client } = makeRequeueScenario();
    const events: Array<AgentStreamEvent | StepEvent> = [];

    const promise = runLensAnalysis({
      client: client.client,
      lens: CORRECTNESS_LENS,
      batches,
      allChangedFilePaths: allPaths(batches),
      onEvent: (event) => events.push(event),
    });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.value.dispatches.map(({ batchIndex, outcome }) => ({ batchIndex, outcome })),
    ).toEqual([
      { batchIndex: 0, outcome: "provider-rejected" },
      { batchIndex: 1, outcome: "completed" },
      { batchIndex: 2, outcome: "completed" },
      { batchIndex: 0, outcome: "completed" },
    ]);
    expect(client.calls()).toBe(4);
    expect(result.value.batchError).toBeUndefined();
    expect(result.value.issues.map((issue) => issue.file).sort()).toEqual([
      "src/one.ts",
      "src/three.ts",
      "src/two.ts",
    ]);
    expect(events.filter((event) => event.type === "agent_error")).toHaveLength(0);
    expect(events.filter((event) => event.type === "agent_complete")).toHaveLength(1);
  });

  it("ends a batch that fails its re-queued attempt", async () => {
    const batches = [makeBatchDiff("src/one.ts"), makeBatchDiff("src/two.ts")];
    const client = makeSequencedAIClient([
      ok({ issues: [makeLensIssue("kept", "file-1", "high")] }),
      dispatchFailure("provider-rejected", true),
      dispatchFailure("provider-rejected", true),
    ]);
    const events: Array<AgentStreamEvent | StepEvent> = [];

    const promise = runLensAnalysis({
      client: client.client,
      lens: CORRECTNESS_LENS,
      batches,
      allChangedFilePaths: allPaths(batches),
      onEvent: (event) => events.push(event),
    });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.dispatches.map((dispatch) => dispatch.outcome)).toEqual([
      "completed",
      "provider-rejected",
      "provider-rejected",
    ]);
    expect(result.value.dispatches.map((dispatch) => dispatch.batchIndex)).toEqual([0, 1, 1]);
    expect(client.calls()).toBe(3);
    expect(result.value.issues.map((issue) => issue.file)).toEqual(["src/one.ts"]);
    expect(result.value.batchError?.diagnostic?.code).toBe("provider-rejected");
    expect(events.filter((event) => event.type === "agent_error")).toHaveLength(1);
  });

  it("reports a lens whose completed batches found nothing as successful", async () => {
    const batches = [makeBatchDiff("src/one.ts"), makeBatchDiff("src/two.ts")];
    const client = makeSequencedAIClient([
      ok({ issues: [] }),
      err({ code: "MODEL_ERROR", message: "Model failed" }),
    ]);
    const events: Array<AgentStreamEvent | StepEvent> = [];

    const promise = runLensAnalysis({
      client: client.client,
      lens: CORRECTNESS_LENS,
      batches,
      allChangedFilePaths: allPaths(batches),
      onEvent: (event) => events.push(event),
    });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.issues).toEqual([]);
    expect(result.value.dispatches.map((dispatch) => dispatch.outcome)).toEqual([
      "completed",
      "MODEL_ERROR",
    ]);
    const completes = events.filter((event) => event.type === "agent_complete");
    expect(completes).toHaveLength(1);
    expect(completes[0]).toMatchObject({ issueCount: 0 });
    expect(events.filter((event) => event.type === "agent_error")).toHaveLength(1);
  });

  it.each<{ label: string; failure: MockGenerateResult }>([
    { label: "provider-rejected", failure: dispatchFailure("provider-rejected", false) },
    { label: "transport-failed", failure: dispatchFailure("transport-failed", false) },
    { label: "budget-exhausted", failure: dispatchFailure("budget-exhausted", false) },
    { label: "schema-failed", failure: dispatchFailure("schema-failed", false) },
    { label: "cancelled", failure: dispatchFailure("cancelled", false) },
    { label: "undiagnosed", failure: err({ code: "MODEL_ERROR", message: "Model failed" }) },
  ])("ends the lens at once on a non-retryable $label failure", async ({ failure }) => {
    const batches = [makeBatchDiff("src/one.ts"), makeBatchDiff("src/two.ts")];
    const client = makeSequencedAIClient([failure, ok({ issues: [] }), ok({ issues: [] })]);

    const promise = runLensAnalysis({
      client: client.client,
      lens: CORRECTNESS_LENS,
      batches,
      allChangedFilePaths: allPaths(batches),
      onEvent: () => {},
    });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(client.calls()).toBe(1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.dispatches).toHaveLength(1);
  });

  it.each([
    { label: "provider-rejected", failure: dispatchFailure("provider-rejected", true) },
    { label: "transport-failed", failure: dispatchFailure("transport-failed", true) },
    { label: "timed-out", failure: dispatchFailure("timed-out", true) },
  ])("re-queues the batch once on a retryable $label failure", async ({ failure }) => {
    const batches = [makeBatchDiff("src/one.ts"), makeBatchDiff("src/two.ts")];
    const client = makeSequencedAIClient([failure, ok({ issues: [] }), ok({ issues: [] })]);

    const promise = runLensAnalysis({
      client: client.client,
      lens: CORRECTNESS_LENS,
      batches,
      allChangedFilePaths: allPaths(batches),
      onEvent: () => {},
    });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(client.calls()).toBe(3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.dispatches.map((dispatch) => dispatch.batchIndex)).toEqual([0, 1, 0]);
  });

  it("re-queues when the review clock still fits one dispatch", async () => {
    const { batches, client } = makeRequeueScenario();

    const promise = runLensAnalysis({
      client: client.client,
      lens: CORRECTNESS_LENS,
      batches,
      allChangedFilePaths: allPaths(batches),
      dispatchWallTimeMs: 600_000,
      reviewClock: { remainingMs: () => 600_000 },
      onEvent: () => {},
    });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    expect(client.calls()).toBe(4);
  });

  it("refuses the re-queue when the review clock cannot fit one dispatch", async () => {
    const { batches, client } = makeRequeueScenario();
    const events: Array<AgentStreamEvent | StepEvent> = [];

    const promise = runLensAnalysis({
      client: client.client,
      lens: CORRECTNESS_LENS,
      batches,
      allChangedFilePaths: allPaths(batches),
      dispatchWallTimeMs: 600_000,
      reviewClock: { remainingMs: () => 599_999 },
      onEvent: (event) => events.push(event),
    });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(client.calls()).toBe(3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.dispatches.map((dispatch) => dispatch.batchIndex)).toEqual([0, 1, 2]);
    expect(events.filter((event) => event.type === "agent_error")).toHaveLength(1);
    expect(result.value.batchError).toBeDefined();
    expect(result.value.issues.map((issue) => issue.file).sort()).toEqual([
      "src/three.ts",
      "src/two.ts",
    ]);
  });

  it("refuses the re-queue once the signal is aborted", async () => {
    const { batches } = makeRequeueScenario();
    const controller = new AbortController();
    let callCount = 0;
    const client: AIClient = {
      provider: "openrouter",
      async generate(_prompt, schema) {
        callCount += 1;
        if (callCount === 1) return dispatchFailure("provider-rejected", true);
        if (callCount === 3) controller.abort();
        return ok({ data: schema.parse({ issues: [] }) });
      },
    };

    const promise = runLensAnalysis({
      client,
      lens: CORRECTNESS_LENS,
      batches,
      allChangedFilePaths: allPaths(batches),
      dispatchWallTimeMs: 600_000,
      signal: controller.signal,
      onEvent: () => {},
    });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(callCount).toBe(3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.batchError).toBeDefined();
  });

  it("re-queues when no review clock or dispatch wall is configured", async () => {
    const { batches, client } = makeRequeueScenario();

    const promise = runLensAnalysis({
      client: client.client,
      lens: CORRECTNESS_LENS,
      batches,
      allChangedFilePaths: allPaths(batches),
      onEvent: () => {},
    });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    expect(client.calls()).toBe(4);
  });

  it("re-queues every retryably failed batch once, in plan order", async () => {
    const batches = [
      makeBatchDiff("src/one.ts"),
      makeBatchDiff("src/two.ts"),
      makeBatchDiff("src/three.ts"),
    ];
    const client = makeSequencedAIClient([
      dispatchFailure("provider-rejected", true),
      ok({ issues: [] }),
      dispatchFailure("provider-rejected", true),
      ok({ issues: [] }),
      ok({ issues: [] }),
    ]);

    const promise = runLensAnalysis({
      client: client.client,
      lens: CORRECTNESS_LENS,
      batches,
      allChangedFilePaths: allPaths(batches),
      onEvent: () => {},
    });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.dispatches.map((dispatch) => dispatch.batchIndex)).toEqual([0, 1, 2, 0, 2]);
    expect(client.calls()).toBe(5);
    expect(result.value.batchError).toBeUndefined();
  });

  it("announces a deferred batch with a progress line and reports each file once", async () => {
    const { batches, client } = makeRequeueScenario();
    const events: Array<AgentStreamEvent | StepEvent> = [];

    const promise = runLensAnalysis({
      client: client.client,
      lens: CORRECTNESS_LENS,
      batches,
      allChangedFilePaths: allPaths(batches),
      onEvent: (event) => events.push(event),
    });
    await vi.advanceTimersByTimeAsync(100);
    await promise;

    const deferrals = events.filter(
      (event) =>
        event.type === "agent_progress" &&
        event.message ===
          "Batch 1/3 failed (provider-rejected) — retrying after the remaining batches",
    );
    expect(deferrals).toHaveLength(1);
    const fileProgress = events.flatMap((event) => (event.type === "file_progress" ? [event] : []));
    expect(fileProgress.map((event) => event.completed)).toEqual([1, 2, 3]);
    expect(fileProgress.every((event) => event.total === 3)).toBe(true);
    expect(events.filter((event) => event.type === "agent_error")).toHaveLength(0);
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

    const promise = runSingleBatchLens(client, diff, onEvent);

    await expect(promise).rejects.toThrow("Network failure");

    const eventCountBefore = events.filter((e) => e.type === "agent_progress").length;
    await vi.advanceTimersByTimeAsync(15000);
    const eventCountAfter = events.filter((e) => e.type === "agent_progress").length;
    expect(eventCountAfter).toBe(eventCountBefore);
  });

  describe("wait heartbeat", () => {
    const heartbeats = (events: Array<AgentStreamEvent | StepEvent>): string[] =>
      events.flatMap((event) =>
        event.type === "agent_progress" && event.progress === 65 && event.message
          ? [event.message]
          : [],
      );

    function runWaitingLens(
      onEvent: (event: AgentStreamEvent | StepEvent) => void,
      generate: AIClient["generate"],
    ) {
      return runLensAnalysis({
        client: { provider: "openrouter", generate },
        lens: CORRECTNESS_LENS,
        batches: [makeAnalysisDiff(1)],
        allChangedFilePaths: allPaths([makeAnalysisDiff(1)]),
        dispatchWallTimeMs: 600_000,
        onEvent,
      });
    }

    it("names the wall the dispatch may run to, beside the elapsed time", async () => {
      const response = createDeferred<Result<unknown, AIError>>();
      const events: Array<AgentStreamEvent | StepEvent> = [];
      const promise = runWaitingLens(
        (event) => events.push(event),
        async (_prompt, schema) => {
          const result = await response.promise;
          return result.ok ? ok({ data: schema.parse(result.value) }) : result;
        },
      );

      await vi.advanceTimersByTimeAsync(4000);
      expect(heartbeats(events)).toContain("Waiting for model response — 4s of up to 600s");

      response.resolve(ok({ issues: [] }));
      await promise;
    });

    it("shows a rate-limit backoff for as long as it holds, then returns to waiting", async () => {
      const response = createDeferred<Result<unknown, AIError>>();
      const events: Array<AgentStreamEvent | StepEvent> = [];
      const promise = runWaitingLens(
        (event) => events.push(event),
        async (_prompt, schema, options) => {
          options?.onProgress?.({ message: "Rate-limited, retrying in 8s", holdsForMs: 8000 });
          const result = await response.promise;
          return result.ok ? ok({ data: schema.parse(result.value) }) : result;
        },
      );

      await vi.advanceTimersByTimeAsync(4000);
      expect(heartbeats(events)).toContain("Rate-limited, retrying in 8s — 4s of up to 600s");

      await vi.advanceTimersByTimeAsync(6000);
      expect(heartbeats(events)).toContain("Waiting for model response — 10s of up to 600s");

      response.resolve(ok({ issues: [] }));
      await promise;
    });

    it("marks the re-queued attempt's heartbeat as a retry", async () => {
      const response = createDeferred<Result<unknown, AIError>>();
      const events: Array<AgentStreamEvent | StepEvent> = [];
      const batches = [makeBatchDiff("src/one.ts"), makeBatchDiff("src/two.ts")];
      let callCount = 0;
      const promise = runLensAnalysis({
        client: {
          provider: "openrouter",
          async generate(_prompt, schema) {
            callCount += 1;
            if (callCount === 1) return dispatchFailure("provider-rejected", true);
            if (callCount === 2) return ok({ data: schema.parse({ issues: [] }) });
            const result = await response.promise;
            return result.ok ? ok({ data: schema.parse(result.value) }) : result;
          },
        },
        lens: CORRECTNESS_LENS,
        batches,
        allChangedFilePaths: allPaths(batches),
        dispatchWallTimeMs: 600_000,
        onEvent: (event) => events.push(event),
      });

      await vi.advanceTimersByTimeAsync(4000);
      expect(heartbeats(events)).toContain(
        "Waiting for model response — 4s of up to 600s (batch 1/2, retry)",
      );

      response.resolve(ok({ issues: [] }));
      await promise;
    });
  });
});

describe("runSynthesisAnalysis", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves file ids against the whole diff and streams under the synthesis lens", async () => {
    const diff = makeParsedDiff([makeAnalysisFile("src/one.ts"), makeAnalysisFile("src/two.ts")]);
    const client = makeMockAIClient(ok({ issues: [makeLensIssue("cross-1", "file-2")] }));
    const events: Array<AgentStreamEvent | StepEvent> = [];

    const promise = runSynthesisAnalysis({
      client,
      diff,
      collectedIssues: [makeLensIssue("correctness:seed", "src/one.ts")],
      onEvent: (event) => events.push(event),
    });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lensId).toBe("synthesis");
    expect(result.value.issues.map((issue) => issue.id)).toEqual(["synthesis:cross-1"]);
    expect(result.value.issues.map((issue) => issue.file)).toEqual(["src/two.ts"]);
    expect(result.value.dispatches).toEqual([
      expect.objectContaining({ batchIndex: 0, outcome: "completed" }),
    ]);

    const starts = events.filter((event) => event.type === "agent_start");
    const completes = events.filter((event) => event.type === "agent_complete");
    expect(starts).toHaveLength(1);
    expect(completes).toHaveLength(1);
    expect(starts[0] && "agent" in starts[0] ? starts[0].agent : undefined).toMatchObject({
      id: "synthesizer",
      lens: "synthesis",
    });
    expect(events.filter((event) => event.type === "issue_found")).toHaveLength(1);
  });

  it("returns the dispatch error and emits agent_error when the synthesis call fails", async () => {
    const diff = makeParsedDiff([makeAnalysisFile("src/one.ts")]);
    const client = makeMockAIClient(err({ code: "MODEL_ERROR", message: "boom" }));
    const events: Array<AgentStreamEvent | StepEvent> = [];

    const promise = runSynthesisAnalysis({
      client,
      diff,
      collectedIssues: [],
      onEvent: (event) => events.push(event),
    });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("MODEL_ERROR");
    expect(result.error.dispatches).toEqual([
      expect.objectContaining({ batchIndex: 0, outcome: "MODEL_ERROR" }),
    ]);
    expect(events.some((event) => event.type === "agent_error")).toBe(true);
    expect(events.some((event) => event.type === "agent_complete")).toBe(false);
  });
});
