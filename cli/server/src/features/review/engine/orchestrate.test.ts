import type { Result } from "@diffgazer/core/result";
import { err, ok } from "@diffgazer/core/result";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import type { AIClient, AIError } from "../../../shared/lib/ai/types.js";
import { makeFileDiff, makeParsedDiff } from "../testing/factories.js";
import { orchestrateReview } from "./orchestrate.js";

function createDiffForFiles(files: string[]) {
  return makeParsedDiff(
    files.map((filePath) =>
      makeFileDiff({
        filePath,
        hunks: [{ oldStart: 1, oldCount: 1, newStart: 1, newCount: 1, content: "" }],
        rawDiff: [
          `diff --git a/${filePath} b/${filePath}`,
          `--- a/${filePath}`,
          `+++ b/${filePath}`,
          "@@ -1 +1 @@",
          "-const value = 0;",
          "+const value = 1;",
        ].join("\n"),
        stats: { additions: 1, deletions: 1, sizeBytes: 80 },
      }),
    ),
  );
}

function budgetExhaustedError(): Result<never, AIError> {
  return err({
    code: "STREAM_ERROR",
    message: "Review budget exhausted at maxInputTokens (10000).",
    diagnostic: {
      code: "budget-exhausted",
      safeMessage: "Review budget exhausted at maxInputTokens (10000).",
      retryable: false,
      remediation: "Reduce review scope or increase configured limits.",
      correlationId: "budget-1",
    },
  });
}

function makeClient(results: Array<Result<unknown, AIError>>): AIClient {
  const queue = [...results];
  return {
    provider: "openrouter",
    generate: async <T extends z.ZodType>(_prompt: string, schema: T) => {
      const next = queue.shift();
      if (!next) {
        return ok(schema.parse({ issues: [] }) as z.output<T>);
      }
      if (!next.ok) return next;

      return ok(schema.parse(next.value) as z.output<T>);
    },
  };
}

describe("orchestrateReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns NO_DIFF without emitting orchestration events when no files changed", async () => {
    const events: Array<{ type: string }> = [];

    const result = await orchestrateReview(
      makeClient([]),
      createDiffForFiles([]),
      { lenses: ["correctness"] },
      (event) => events.push({ type: event.type }),
      { concurrency: 2 },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NO_DIFF");
    expect(events).toEqual([]);
  });

  it("returns sorted, deduplicated issues and complete orchestration metadata", async () => {
    const events: Array<Record<string, unknown>> = [];
    const sharedIssue = makeIssue({ id: "dup-1", file: "file-1" });
    const lowIssue = makeIssue({ id: "low-1", file: "file-2", severity: "low" });
    const client = makeClient([
      ok({ issues: [sharedIssue] }),
      ok({ issues: [{ ...sharedIssue, id: "dup-2" }, lowIssue] }),
    ]);

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts", "src/b.ts"]),
      { lenses: ["correctness", "security"] },
      (event) => events.push(event as Record<string, unknown>),
      { concurrency: 2 },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.issues.map((issue) => issue.id)).toEqual([
        "correctness:dup-1",
        "security:low-1",
      ]);
      expect(result.value.issues.map((issue) => issue.severity)).toEqual(["high", "low"]);
      expect(result.value.lensStats).toMatchObject([
        { lensId: "correctness", issueCount: 1, status: "success" },
        { lensId: "security", issueCount: 2, status: "success" },
      ]);
    }

    expect(events.find((event) => event.type === "orchestrator_start")).toMatchObject({
      concurrency: 2,
    });
    const completeEvent = events.find((event) => event.type === "orchestrator_complete");
    expect(completeEvent).toMatchObject({
      totalIssues: 2,
      filesAnalyzed: 2,
    });
    expect(completeEvent).not.toHaveProperty("summary");
    expect(JSON.stringify(events)).not.toMatch(/"(?:traceId|spanId|parentSpanId)":/);
  });

  it("keeps successful lens output and reports the failed lens in its stats", async () => {
    const client = makeClient([
      ok({ issues: [makeIssue({ id: "issue-1", file: "file-1" })] }),
      err({ code: "MODEL_ERROR", message: "Second lens failed" }),
    ]);

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts"]),
      { lenses: ["correctness", "security"] },
      () => {},
      { concurrency: 2 },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.issues).toHaveLength(1);
      expect(result.value.lensStats.filter((lens) => lens.status === "failed")).toEqual([
        expect.objectContaining({ lensId: "security", errorCode: "MODEL_ERROR" }),
      ]);
    }
  });

  it("returns the last error when every lens fails", async () => {
    const failed = await orchestrateReview(
      makeClient([
        err({ code: "MODEL_ERROR", message: "Correctness failed" }),
        err({ code: "NETWORK_ERROR", message: "Security failed" }),
      ]),
      createDiffForFiles(["src/a.ts"]),
      { lenses: ["correctness", "security"] },
      () => {},
      { concurrency: 2 },
    );

    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.error.code).toBe("NETWORK_ERROR");
  });

  it("stops dispatching the remaining lenses at the first structured-output failure", async () => {
    const generate = vi.fn(async (_prompt: string, schema: z.ZodType) => {
      void schema;
      return err({ code: "PARSE_ERROR", message: "Adapter response failed schema validation" });
    });
    const client = { provider: "openrouter", generate } as unknown as AIClient;

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts"]),
      { lenses: ["correctness", "security", "performance"] },
      () => {},
      { concurrency: 1 },
    );

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PARSE_ERROR");
  });

  it("stops dispatching the remaining lenses after the first budget-exhausted settlement", async () => {
    const client = makeClient([
      ok({ issues: [makeIssue({ id: "issue-1", file: "file-1" })] }),
      budgetExhaustedError(),
    ]);
    const generate = vi.spyOn(client, "generate");

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts"]),
      { lenses: ["correctness", "security", "performance", "simplicity", "tests"] },
      () => {},
      { concurrency: 1 },
    );

    // Only the successful lens and the one that exhausted the budget were paid
    // for; the remaining three were never dispatched.
    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.issues).toHaveLength(1);
    expect(
      result.value.lensStats.filter((lens) => lens.status === "failed").map((lens) => lens.lensId),
    ).toEqual(["security", "performance", "simplicity", "tests"]);
  });

  it("reports the lenses it never dispatched as budget-skipped, not cancelled", async () => {
    const events: Array<Record<string, unknown>> = [];
    const client = makeClient([
      ok({ issues: [makeIssue({ id: "issue-1", file: "file-1" })] }),
      budgetExhaustedError(),
    ]);

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts"]),
      { lenses: ["correctness", "security", "performance", "simplicity", "tests"] },
      (event) => events.push(event as Record<string, unknown>),
      { concurrency: 1 },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const skippedMessage = "Not dispatched — the review budget was exhausted.";
    expect(result.value.lensStats.slice(2)).toEqual([
      {
        lensId: "performance",
        issueCount: 0,
        status: "failed",
        errorCode: "BUDGET_EXHAUSTED",
        errorMessage: skippedMessage,
      },
      {
        lensId: "simplicity",
        issueCount: 0,
        status: "failed",
        errorCode: "BUDGET_EXHAUSTED",
        errorMessage: skippedMessage,
      },
      {
        lensId: "tests",
        issueCount: 0,
        status: "failed",
        errorCode: "BUDGET_EXHAUSTED",
        errorMessage: skippedMessage,
      },
    ]);
    expect(result.value.lensStats.map((lens) => lens.errorCode)).not.toContain("CANCELLED");
    // Without a terminal agent event these rows stay "queued" on the live board.
    expect(
      events
        .filter((event) => event.type === "agent_error")
        .map((event) => ({ agent: event.agent, error: event.error })),
    ).toEqual([
      {
        agent: "guardian",
        error: "STREAM_ERROR: Review budget exhausted at maxInputTokens (10000).",
      },
      { agent: "optimizer", error: skippedMessage },
      { agent: "simplifier", error: skippedMessage },
      { agent: "tester", error: skippedMessage },
    ]);
  });

  it("lets the lenses already in flight settle when another exhausts the budget", async () => {
    const events: Array<Record<string, unknown>> = [];
    const releases: Array<() => void> = [];
    let dispatchCount = 0;
    const client: AIClient = {
      provider: "openrouter",
      generate: async <T extends z.ZodType>(
        _prompt: string,
        schema: T,
        options?: Readonly<{ signal?: AbortSignal }>,
      ) => {
        dispatchCount += 1;
        if (dispatchCount === 2) return budgetExhaustedError();
        const issue = makeIssue({ id: `issue-${dispatchCount}`, file: `file-${dispatchCount}` });
        // A real adapter drops its in-flight request when the signal it was
        // handed aborts, so the stub does too — that is what tells the dispatch
        // signal apart from the per-lens one.
        await new Promise<void>((resolve, reject) => {
          releases.push(resolve);
          options?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        });
        return ok(schema.parse({ issues: [issue] }) as z.output<T>);
      },
    };

    const resultPromise = orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts", "src/b.ts", "src/c.ts"]),
      { lenses: ["correctness", "security", "performance", "simplicity", "tests"] },
      (event) => events.push(event as Record<string, unknown>),
      { concurrency: 3 },
    );

    // Guardian's agent_error marks the budget settlement; correctness and
    // performance are still waiting on the provider at that moment.
    await vi.waitFor(() => {
      expect(events.some((event) => event.type === "agent_error")).toBe(true);
      expect(releases).toHaveLength(2);
    });
    for (const release of releases) release();
    const result = await resultPromise;

    // All three co-dispatched lenses were paid for; the last two never were.
    expect(dispatchCount).toBe(3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lensStats).toMatchObject([
      { lensId: "correctness", issueCount: 1, status: "success" },
      { lensId: "security", status: "failed", errorCode: "STREAM_ERROR" },
      { lensId: "performance", issueCount: 1, status: "success" },
      { lensId: "simplicity", status: "failed", errorCode: "BUDGET_EXHAUSTED" },
      { lensId: "tests", status: "failed", errorCode: "BUDGET_EXHAUSTED" },
    ]);
    expect(result.value.issues.map((issue) => issue.id)).toEqual([
      "correctness:issue-1",
      "performance:issue-3",
    ]);
  });

  it("blames the budget only for the lenses it never dispatched, not for one that threw", async () => {
    const events: Array<Record<string, unknown>> = [];
    const settlements: Array<{ resolve: () => void; reject: (reason: unknown) => void }> = [];
    let dispatchCount = 0;
    const client: AIClient = {
      provider: "openrouter",
      generate: async <T extends z.ZodType>(_prompt: string, schema: T) => {
        dispatchCount += 1;
        if (dispatchCount === 2) return budgetExhaustedError();
        const issue = makeIssue({ id: `issue-${dispatchCount}`, file: `file-${dispatchCount}` });
        await new Promise<void>((resolve, reject) => {
          settlements.push({ resolve, reject });
        });
        return ok(schema.parse({ issues: [issue] }) as z.output<T>);
      },
    };

    const resultPromise = orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts", "src/b.ts", "src/c.ts"]),
      { lenses: ["correctness", "security", "performance", "simplicity", "tests"] },
      (event) => events.push(event as Record<string, unknown>),
      { concurrency: 3 },
    );

    await vi.waitFor(() => {
      expect(events.some((event) => event.type === "agent_error")).toBe(true);
      expect(settlements).toHaveLength(2);
    });
    settlements[0]?.resolve();
    // The optimizer's own transport gives up after the budget settlement: an
    // abort nobody here asked for, on a lens the review did pay to dispatch.
    settlements[1]?.reject(new DOMException("Aborted", "AbortError"));
    const result = await resultPromise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lensStats).toMatchObject([
      { lensId: "correctness", issueCount: 1, status: "success" },
      { lensId: "security", status: "failed", errorCode: "STREAM_ERROR" },
      { lensId: "performance", status: "failed", errorCode: "CANCELLED", errorMessage: "Aborted" },
      { lensId: "simplicity", status: "failed", errorCode: "BUDGET_EXHAUSTED" },
      { lensId: "tests", status: "failed", errorCode: "BUDGET_EXHAUSTED" },
    ]);
    // One terminal row for that lens, carrying its own failure, not the budget's.
    expect(
      events
        .filter((event) => event.type === "agent_error" && event.agent === "optimizer")
        .map((event) => event.error),
    ).toEqual(["AbortError: Aborted"]);
  });

  it("keeps the findings of a lens that decoded while another lens failed structured output", async () => {
    const client = makeClient([
      err({
        code: "STREAM_ERROR",
        message: "Adapter response failed schema validation",
        diagnostic: {
          code: "schema-failed",
          safeMessage: "Adapter response failed schema validation",
          retryable: false,
          remediation: "Select a different model.",
          correlationId: "correlation-1",
        },
      }),
      ok({ issues: [makeIssue({ id: "issue-1", file: "file-1" })] }),
    ]);

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts"]),
      { lenses: ["correctness", "security"] },
      () => {},
      { concurrency: 2 },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.issues.map((issue) => issue.id)).toEqual(["security:issue-1"]);
      expect(result.value.lensStats).toMatchObject([
        { lensId: "correctness", status: "failed", errorCode: "STREAM_ERROR" },
        { lensId: "security", issueCount: 1, status: "success" },
      ]);
    }
  });

  it("treats a structured-output failure after a successful lens as a flake", async () => {
    const client = makeClient([
      ok({ issues: [makeIssue({ id: "issue-1", file: "file-1" })] }),
      err({ code: "PARSE_ERROR", message: "Adapter response failed schema validation" }),
    ]);

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts"]),
      { lenses: ["correctness", "security"] },
      () => {},
      { concurrency: 1 },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.issues).toHaveLength(1);
  });

  it("honors the severity filter from review options", async () => {
    const client = makeClient([
      ok({
        issues: [
          makeIssue({ id: "high-1", file: "file-1", severity: "high" }),
          makeIssue({ id: "low-1", file: "file-1", severity: "low" }),
        ],
      }),
    ]);

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts"]),
      { lenses: ["correctness"], filter: { minSeverity: "high" } },
      () => {},
      { concurrency: 1 },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.issues.map((issue) => issue.id)).toEqual(["correctness:high-1"]);
    }
  });

  it("marks unstarted lenses as failed when aborted", async () => {
    const controller = new AbortController();
    const client: AIClient = {
      provider: "openrouter",
      generate: async <T extends z.ZodType>(_prompt: string, schema: T) => {
        controller.abort("cancel test");
        return ok(schema.parse({ issues: [] }) as z.output<T>);
      },
    };

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts"]),
      { lenses: ["correctness", "security", "performance"] },
      () => {},
      { concurrency: 1, signal: controller.signal },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.lensStats).toHaveLength(3);
      const failed = result.value.lensStats.filter((lens) => lens.status === "failed");
      expect(failed.map((lens) => lens.lensId)).toEqual(["security", "performance"]);
      expect(failed.every((lens) => lens.errorCode === "CANCELLED")).toBe(true);
    }
  });

  it("maps an unexpected internal throw to INTERNAL_ERROR (not NETWORK_ERROR)", async () => {
    const client: AIClient = {
      provider: "openrouter",
      generate: async () => {
        throw new Error("boom");
      },
    };

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts"]),
      { lenses: ["correctness"] },
      () => {},
      { concurrency: 1 },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR");
  });

  it("reports droppedDuplicates and droppedBelowThreshold on orchestrator_complete", async () => {
    const events: Array<Record<string, unknown>> = [];
    const sharedIssue = makeIssue({
      id: "dup-1",
      file: "file-1",
      severity: "high",
      title: "Shared bug",
      line_start: 10,
    });
    const nit = makeIssue({
      id: "nit-1",
      file: "file-1",
      severity: "nit",
      title: "Tiny style",
      line_start: 20,
    });
    const client = makeClient([
      ok({ issues: [sharedIssue, nit] }),
      ok({ issues: [{ ...sharedIssue, id: "dup-2" }] }),
    ]);

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts"]),
      { lenses: ["correctness", "security"], filter: { minSeverity: "low" } },
      (event) => events.push(event as Record<string, unknown>),
      { concurrency: 2 },
    );

    expect(result.ok).toBe(true);
    const complete = events.find((event) => event.type === "orchestrator_complete");
    expect(complete).toMatchObject({
      droppedDuplicates: 1,
      droppedBelowThreshold: 1,
      minSeverity: "low",
    });
    if (result.ok) {
      expect(result.value.droppedDuplicates).toBe(1);
      expect(result.value.droppedBelowThreshold).toBe(1);
      expect(result.value.minSeverity).toBe("low");
    }
  });

  it("drops incomplete provider output before streaming, lens counts, and deduplication", async () => {
    const events: Array<Record<string, unknown>> = [];
    const complete = makeIssue({
      id: "complete-medium",
      file: "file-1",
      severity: "medium",
      title: "Shared bug",
      line_start: 10,
    });
    const incomplete = makeIssue({
      id: "incomplete-high",
      file: "file-1",
      severity: "high",
      title: "Shared bug",
      line_start: 10,
    });
    incomplete.symptom = "   ";
    const client = makeClient([ok({ issues: [complete] }), ok({ issues: [incomplete] })]);

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts"]),
      { lenses: ["correctness", "security"] },
      (event) => events.push(event as Record<string, unknown>),
      { concurrency: 2 },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.issues.map((issue) => issue.id)).toEqual(["correctness:complete-medium"]);
    expect(result.value.lensStats).toMatchObject([
      { lensId: "correctness", issueCount: 1 },
      { lensId: "security", issueCount: 0 },
    ]);
    expect(result.value.droppedDuplicates).toBe(0);
    expect(events.filter((event) => event.type === "issue_found")).toHaveLength(1);
    expect(events.find((event) => event.type === "orchestrator_complete")).toMatchObject({
      totalIssues: 1,
      droppedDuplicates: 0,
      droppedIncompleteProviderIssues: 1,
    });
  });

  it.each([
    1, 2,
  ])("bounds in-flight AI calls to a concurrency of %i across three lenses and completes them in order once released", async (concurrency) => {
    const pendingReleases: Array<() => void> = [];
    let started = 0;
    let inFlight = 0;
    let maxInFlight = 0;

    const client: AIClient = {
      provider: "openrouter",
      generate: async <T extends z.ZodType>(_prompt: string, schema: T) => {
        started++;
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise<void>((resolve) => pendingReleases.push(resolve));
        inFlight--;
        return ok(schema.parse({ issues: [] }) as z.output<T>);
      },
    };

    const resultPromise = orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts"]),
      { lenses: ["correctness", "security", "performance"] },
      () => {},
      { concurrency },
    );

    await vi.waitFor(() => expect(pendingReleases).toHaveLength(concurrency));
    expect(maxInFlight).toBe(concurrency);

    for (let i = 0; i < 3; i++) {
      await vi.waitFor(() => expect(pendingReleases.length).toBeGreaterThan(0));
      pendingReleases.shift()?.();
    }

    const result = await resultPromise;

    expect(started).toBe(3);
    expect(maxInFlight).toBe(concurrency);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.lensStats.map((lens) => lens.lensId)).toEqual([
        "correctness",
        "security",
        "performance",
      ]);
      expect(result.value.lensStats.every((lens) => lens.status === "success")).toBe(true);
    }
  });
});
