import type { Result } from "@diffgazer/core/result";
import { err, ok } from "@diffgazer/core/result";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { describe, expect, it, vi } from "vitest";
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

function unparseableResponseError(): Result<never, AIError> {
  return err({
    code: "STREAM_ERROR",
    message: "OpenRouter answered HTTP 200 with a text/html body that is not JSON.",
    diagnostic: {
      code: "unparseable-response",
      safeMessage: "OpenRouter answered HTTP 200 with a text/html body that is not JSON.",
      retryable: true,
      remediation: "Retry.",
      correlationId: "correlation-unparseable",
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
        return ok({ data: schema.parse({ issues: [] }) as z.output<T> });
      }
      if (!next.ok) return next;

      return ok({ data: schema.parse(next.value) as z.output<T> });
    },
  };
}

describe("orchestrateReview", () => {
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
      batchesAnalyzed: 1,
      batchesPlanned: 1,
    });
    expect(completeEvent).not.toHaveProperty("summary");
    expect(JSON.stringify(events)).not.toMatch(/"(?:traceId|spanId|parentSpanId)":/);
  });

  it("dispatches one call per planned batch and only the batch's own files", async () => {
    const prompts: string[] = [];
    const client: AIClient = {
      provider: "openrouter",
      generate: async <T extends z.ZodType>(prompt: string, schema: T) => {
        prompts.push(prompt);
        return ok({ data: schema.parse({ issues: [] }) as z.output<T> });
      },
    };

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts", "src/b.ts"]),
      { lenses: ["correctness"] },
      () => {},
      {
        concurrency: 1,
        batches: [createDiffForFiles(["src/a.ts"]), createDiffForFiles(["src/b.ts"])],
      },
    );

    expect(result.ok).toBe(true);
    // Two batch calls, then the synthesis pass a batched review earns.
    expect(prompts).toHaveLength(3);
    // The raw diff header only appears where the file's own diff was rendered.
    expect(prompts[0]).toContain("+++ b/src/a.ts");
    expect(prompts[0]).not.toContain("+++ b/src/b.ts");
    expect(prompts[1]).toContain("+++ b/src/b.ts");
    expect(prompts[1]).not.toContain("+++ b/src/a.ts");
    // Synthesis names every changed file but carries no diff at all; the output
    // contract's literal "+++ b/<file>" placeholder is the only header-like text.
    expect(prompts[2]).toContain('display-path="src/a.ts"');
    expect(prompts[2]).toContain('display-path="src/b.ts"');
    expect(prompts[2]).not.toContain("+++ b/src/");
  });

  it("skips the synthesis pass on a single-batch review", async () => {
    const prompts: string[] = [];
    const client: AIClient = {
      provider: "openrouter",
      generate: async <T extends z.ZodType>(prompt: string, schema: T) => {
        prompts.push(prompt);
        return ok({ data: schema.parse({ issues: [] }) as z.output<T> });
      },
    };
    const diff = createDiffForFiles(["src/a.ts", "src/b.ts"]);

    const result = await orchestrateReview(client, diff, { lenses: ["correctness"] }, () => {}, {
      concurrency: 1,
      batches: [diff],
    });

    expect(result.ok).toBe(true);
    expect(prompts).toHaveLength(1);
    if (result.ok) {
      expect(result.value.lensStats.map((stat) => stat.lensId)).toEqual(["correctness"]);
    }
  });

  it("dispatches synthesis once after the lens fold and reports its LensStat row", async () => {
    const events: Array<Record<string, unknown>> = [];
    const crossFileIssue = makeIssue({
      id: "cross-1",
      file: "file-1",
      title: "Schema changed without its consumer",
    });
    // Two lenses x two batches = four lens calls, then exactly one synthesis call.
    const client = makeClient([
      ok({ issues: [makeIssue({ id: "batch-a", file: "file-1" })] }),
      ok({ issues: [] }),
      ok({ issues: [] }),
      ok({ issues: [] }),
      ok({ issues: [crossFileIssue] }),
    ]);

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts", "src/b.ts"]),
      { lenses: ["correctness", "security"] },
      (event) => events.push(event as Record<string, unknown>),
      {
        concurrency: 1,
        batches: [createDiffForFiles(["src/a.ts"]), createDiffForFiles(["src/b.ts"])],
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.lensStats).toContainEqual(
        expect.objectContaining({ lensId: "synthesis", issueCount: 1, status: "success" }),
      );
      expect(result.value.issues.map((issue) => issue.id)).toContain("synthesis:cross-1");
    }
    const synthesisStarts = events.filter(
      (event) =>
        event.type === "agent_start" &&
        (event.agent as { id?: string } | undefined)?.id === "synthesizer",
    );
    expect(synthesisStarts).toHaveLength(1);
  });

  it("reports a synthesis failure as a failed lens while keeping the review's findings", async () => {
    const client = makeClient([
      ok({ issues: [makeIssue({ id: "kept-1", file: "file-1" })] }),
      ok({ issues: [] }),
      err({ code: "MODEL_ERROR", message: "synthesis dispatch failed" }),
    ]);

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts", "src/b.ts"]),
      { lenses: ["correctness"] },
      () => {},
      {
        concurrency: 1,
        batches: [createDiffForFiles(["src/a.ts"]), createDiffForFiles(["src/b.ts"])],
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.issues.map((issue) => issue.id)).toEqual(["correctness:kept-1"]);
      expect(result.value.lensStats).toContainEqual(
        expect.objectContaining({
          lensId: "synthesis",
          issueCount: 0,
          status: "failed",
          errorCode: "MODEL_ERROR",
          errorMessage: "synthesis dispatch failed",
        }),
      );
      expect(result.value.lensStats.find((stat) => stat.lensId === "correctness")?.status).toBe(
        "success",
      );
    }
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

  it("records droppedCandidateCount on the salvaged lens's stat", async () => {
    const events: Array<Record<string, unknown>> = [];
    let call = 0;
    const client: AIClient = {
      provider: "openrouter",
      generate: async <T extends z.ZodType>(_prompt: string, schema: T) => {
        call += 1;
        if (call === 1) {
          return ok({
            data: schema.parse({
              issues: [makeIssue({ id: "kept-1", file: "file-1" })],
            }) as z.output<T>,
            warning: { droppedCandidateCount: 4 },
          });
        }
        return ok({ data: schema.parse({ issues: [] }) as z.output<T> });
      },
    };

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts"]),
      { lenses: ["correctness", "security"] },
      (event) => events.push(event as Record<string, unknown>),
      { concurrency: 1 },
    );

    expect(result.ok).toBe(true);
    const complete = events.find((event) => event.type === "orchestrator_complete");
    const lensStats = complete?.lensStats as Array<Record<string, unknown>>;
    expect(lensStats).toMatchObject([
      { lensId: "correctness", status: "success", droppedCandidateCount: 4 },
      { lensId: "security", status: "success" },
    ]);
    // A lens that answered in full stays byte-identical: no key at all.
    expect(lensStats[1]).not.toHaveProperty("droppedCandidateCount");
  });

  it("records droppedCandidateCount on the synthesis stat when its answer was salvaged", async () => {
    const events: Array<Record<string, unknown>> = [];
    let call = 0;
    // Two batch calls for the single lens, then the synthesis pass on call 3.
    const client: AIClient = {
      provider: "openrouter",
      generate: async <T extends z.ZodType>(_prompt: string, schema: T) => {
        call += 1;
        if (call === 3) {
          return ok({
            data: schema.parse({
              issues: [makeIssue({ id: "cross-1", file: "file-1" })],
            }) as z.output<T>,
            warning: { droppedCandidateCount: 2 },
          });
        }
        return ok({ data: schema.parse({ issues: [] }) as z.output<T> });
      },
    };

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts", "src/b.ts"]),
      { lenses: ["correctness"] },
      (event) => events.push(event as Record<string, unknown>),
      {
        concurrency: 1,
        batches: [createDiffForFiles(["src/a.ts"]), createDiffForFiles(["src/b.ts"])],
      },
    );

    expect(result.ok).toBe(true);
    const complete = events.find((event) => event.type === "orchestrator_complete");
    const lensStats = complete?.lensStats as Array<Record<string, unknown>>;
    expect(lensStats.find((stat) => stat.lensId === "synthesis")).toMatchObject({
      status: "success",
      droppedCandidateCount: 2,
    });
    // The whole-answer lens stat stays byte-identical: no key at all.
    expect(lensStats.find((stat) => stat.lensId === "correctness")).not.toHaveProperty(
      "droppedCandidateCount",
    );
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

  it("carries the per-lens stats and their dispatch entries on an all-lenses-failed error", async () => {
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
    if (failed.ok) return;
    expect(failed.error.lensStats).toMatchObject([
      {
        lensId: "correctness",
        status: "failed",
        dispatches: [expect.objectContaining({ batchIndex: 0, outcome: "MODEL_ERROR" })],
      },
      {
        lensId: "security",
        status: "failed",
        dispatches: [expect.objectContaining({ batchIndex: 0, outcome: "NETWORK_ERROR" })],
      },
    ]);
  });

  it("runs every lens despite schema failures and returns the unanimous structured-output verdict", async () => {
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

    // One schema failure does not abort the run: every lens gets its dispatch.
    expect(generate).toHaveBeenCalledTimes(3);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PARSE_ERROR");
      expect(result.error.allLensesSchemaFailed).toBe(true);
      expect(result.error.lensStats).toHaveLength(3);
    }
  });

  it("counts an adapter cause-naming schema diagnostic toward the unanimous verdict", async () => {
    const client = makeClient([
      err({
        code: "STREAM_ERROR",
        message: "The model's answer failed review schema validation.",
        diagnostic: {
          code: "malformed-review-output",
          safeMessage: "The model's answer failed review schema validation.",
          retryable: false,
          remediation: "none",
          correlationId: "correlation-malformed",
        },
      }),
    ]);

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts"]),
      { lenses: ["correctness"] },
      () => {},
      { concurrency: 1 },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.allLensesSchemaFailed).toBe(true);
  });

  it("reports a mixed all-failed run by its non-schema error, never as a structured-output verdict", async () => {
    const client = makeClient([
      err({
        code: "STREAM_ERROR",
        message: "Adapter response failed schema validation",
        diagnostic: {
          code: "schema-failed",
          safeMessage: "Adapter response failed schema validation",
          retryable: false,
          remediation: "Select a different model.",
          correlationId: "correlation-schema",
        },
      }),
      err({ code: "NETWORK_ERROR", message: "Security failed" }),
    ]);

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts"]),
      { lenses: ["correctness", "security"] },
      () => {},
      { concurrency: 1 },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NETWORK_ERROR");
      expect(result.error.allLensesSchemaFailed).toBeUndefined();
    }
  });

  it("does not count a provider-response diagnostic toward the structured-output verdict", async () => {
    const client = makeClient([unparseableResponseError(), unparseableResponseError()]);
    const generate = vi.spyOn(client, "generate");

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts"]),
      { lenses: ["correctness"] },
      () => {},
      { concurrency: 1 },
    );

    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.allLensesSchemaFailed).toBeUndefined();
    expect(result.error.code).toBe("STREAM_ERROR");
    expect(result.error.lensStats[0]).toMatchObject({ lensId: "correctness", status: "failed" });
    expect(result.error.lensStats[0]?.dispatches?.map((dispatch) => dispatch.outcome)).toEqual([
      "unparseable-response",
      "unparseable-response",
    ]);
  });

  it("retries a single-batch lens once and files it success when the retry answers", async () => {
    const client = makeClient([unparseableResponseError()]);
    const generate = vi.spyOn(client, "generate");
    const events: Array<Record<string, unknown>> = [];

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts"]),
      { lenses: ["correctness"] },
      (event) => events.push(event as Record<string, unknown>),
      { concurrency: 1 },
    );

    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lensStats).toHaveLength(1);
    expect(result.value.lensStats[0]).toMatchObject({
      lensId: "correctness",
      status: "success",
      issueCount: 0,
    });
    expect(result.value.lensStats[0]?.errorCode).toBeUndefined();
    expect(result.value.lensStats[0]?.dispatches?.map((dispatch) => dispatch.outcome)).toEqual([
      "unparseable-response",
      "completed",
    ]);
    expect(events.filter((event) => event.type === "agent_error")).toHaveLength(0);
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
        error: "budget-exhausted: Review budget exhausted at maxInputTokens (10000).",
      },
      { agent: "optimizer", error: skippedMessage },
      { agent: "simplifier", error: skippedMessage },
      { agent: "tester", error: skippedMessage },
    ]);
  });

  it("aborts the lenses still in flight when another exhausts the budget", async () => {
    let releaseCorrectness = () => {};
    const correctnessGate = new Promise<void>((resolve) => {
      releaseCorrectness = resolve;
    });
    let releaseBudgetError = () => {};
    const budgetErrorGate = new Promise<void>((resolve) => {
      releaseBudgetError = resolve;
    });
    let dispatchCount = 0;
    const client: AIClient = {
      provider: "openrouter",
      generate: async <T extends z.ZodType>(
        _prompt: string,
        schema: T,
        options?: Readonly<{ signal?: AbortSignal }>,
      ) => {
        dispatchCount += 1;
        if (dispatchCount === 1) {
          await correctnessGate;
          return ok({
            data: schema.parse({ issues: [makeIssue({ id: "issue-1", file: "file-1" })] }),
          });
        }
        if (dispatchCount === 2) {
          await budgetErrorGate;
          return budgetExhaustedError();
        }
        // A real adapter drops its in-flight request when the signal it was
        // handed aborts, so the stub does too.
        return new Promise((_, reject) => {
          options?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        });
      },
    };

    const resultPromise = orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts", "src/b.ts", "src/c.ts"]),
      { lenses: ["correctness", "security", "performance", "simplicity", "tests"] },
      () => {},
      { concurrency: 3 },
    );

    await vi.waitFor(() => expect(dispatchCount).toBe(3));
    releaseCorrectness();
    // Correctness settled, so simplicity takes its slot and hangs in flight too.
    await vi.waitFor(() => expect(dispatchCount).toBe(4));
    releaseBudgetError();
    const result = await resultPromise;

    // The budget death aborted the two lenses in flight; the last never launched.
    expect(dispatchCount).toBe(4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cancelledMessage = "Cancelled — the review budget was exhausted.";
    expect(result.value.lensStats).toMatchObject([
      { lensId: "correctness", issueCount: 1, status: "success" },
      { lensId: "security", status: "failed", errorCode: "STREAM_ERROR" },
      {
        lensId: "performance",
        status: "failed",
        errorCode: "BUDGET_EXHAUSTED",
        errorMessage: cancelledMessage,
      },
      {
        lensId: "simplicity",
        status: "failed",
        errorCode: "BUDGET_EXHAUSTED",
        errorMessage: cancelledMessage,
      },
      {
        lensId: "tests",
        status: "failed",
        errorCode: "BUDGET_EXHAUSTED",
        errorMessage: "Not dispatched — the review budget was exhausted.",
      },
    ]);
    expect(result.value.issues.map((issue) => issue.id)).toEqual(["correctness:issue-1"]);
  });

  it("aborts every in-flight lens when the review clock expires and blames the budget", async () => {
    const clockAbort = new AbortController();
    let clockExpired = false;
    let dispatchCount = 0;
    const client: AIClient = {
      provider: "openrouter",
      generate: async <T extends z.ZodType>(
        _prompt: string,
        _schema: T,
        options?: Readonly<{ signal?: AbortSignal }>,
      ) =>
        new Promise<never>((_, reject) => {
          dispatchCount += 1;
          options?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    };

    const resultPromise = orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts"]),
      { lenses: ["correctness", "security", "performance"] },
      () => {},
      {
        concurrency: 3,
        reviewClock: {
          signal: clockAbort.signal,
          remainingMs: () => 0,
          expired: () => clockExpired,
        },
      },
    );

    await vi.waitFor(() => expect(dispatchCount).toBe(3));
    clockExpired = true;
    clockAbort.abort(new DOMException("Execution deadline exceeded", "TimeoutError"));
    const result = await resultPromise;

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("BUDGET_EXHAUSTED");
    expect(result.error.lensStats).toMatchObject([
      { lensId: "correctness", status: "failed", errorCode: "BUDGET_EXHAUSTED" },
      { lensId: "security", status: "failed", errorCode: "BUDGET_EXHAUSTED" },
      { lensId: "performance", status: "failed", errorCode: "BUDGET_EXHAUSTED" },
    ]);
  });

  it("keeps a genuine user cancellation as CANCELLED for the lenses in flight", async () => {
    const userAbort = new AbortController();
    let dispatchCount = 0;
    const client: AIClient = {
      provider: "openrouter",
      generate: async <T extends z.ZodType>(
        _prompt: string,
        _schema: T,
        options?: Readonly<{ signal?: AbortSignal }>,
      ) =>
        new Promise<never>((_, reject) => {
          dispatchCount += 1;
          options?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    };

    const resultPromise = orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts"]),
      { lenses: ["correctness", "security", "performance"] },
      () => {},
      { concurrency: 3, signal: userAbort.signal },
    );

    await vi.waitFor(() => expect(dispatchCount).toBe(3));
    userAbort.abort("cancel test");
    const result = await resultPromise;

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("CANCELLED");
    expect(result.error.lensStats.every((lens) => lens.errorCode === "CANCELLED")).toBe(true);
  });

  it("carries requestedConcurrency on orchestrator_start only when the clamp reduced it", async () => {
    const runWith = async (requestedConcurrency?: number) => {
      const events: Array<Record<string, unknown>> = [];
      await orchestrateReview(
        makeClient([]),
        createDiffForFiles(["src/a.ts"]),
        { lenses: ["correctness"] },
        (event) => events.push(event as Record<string, unknown>),
        {
          concurrency: 1,
          ...(requestedConcurrency !== undefined ? { requestedConcurrency } : {}),
        },
      );
      return events.find((event) => event.type === "orchestrator_start");
    };

    expect(await runWith(5)).toMatchObject({ concurrency: 1, requestedConcurrency: 5 });
    expect(await runWith()).not.toHaveProperty("requestedConcurrency");
  });

  it("completes the same lens set sequentially and in parallel under one clock", async () => {
    const runAt = async (concurrency: number) => {
      let dispatchCount = 0;
      const client: AIClient = {
        provider: "openrouter",
        generate: async <T extends z.ZodType>(_prompt: string, schema: T) => {
          dispatchCount += 1;
          const issueId = `issue-${dispatchCount}`;
          await new Promise((resolve) => setTimeout(resolve, 5));
          return ok({
            data: schema.parse({ issues: [makeIssue({ id: issueId, file: "file-1" })] }),
          });
        },
      };
      return orchestrateReview(
        client,
        createDiffForFiles(["src/a.ts"]),
        { lenses: ["correctness", "security", "performance", "simplicity", "tests"] },
        () => {},
        { concurrency },
      );
    };

    const [sequential, parallel] = await Promise.all([runAt(1), runAt(5)]);
    expect(sequential.ok).toBe(true);
    expect(parallel.ok).toBe(true);
    if (!sequential.ok || !parallel.ok) return;
    const successSet = (stats: Array<{ lensId: string; status: string }>) =>
      stats.filter((lens) => lens.status === "success").map((lens) => lens.lensId);
    expect(successSet(parallel.value.lensStats)).toEqual(successSet(sequential.value.lensStats));
    expect(successSet(parallel.value.lensStats)).toHaveLength(5);
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
    if (result.ok) {
      expect(result.value.issues.map((issue) => issue.id)).toEqual(["correctness:issue-1"]);
      expect(result.value.lensStats.map((lens) => lens.status)).toEqual(["success", "failed"]);
    }
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
        return ok({ data: schema.parse({ issues: [] }) as z.output<T> });
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

  it("reports coverage for a lens that completed one of two batches", async () => {
    const events: Array<Record<string, unknown>> = [];
    const client = makeClient([
      ok({ issues: [makeIssue({ id: "issue-1", file: "file-1" })] }),
      err({ code: "MODEL_ERROR", message: "Model failed" }),
    ]);

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts", "src/b.ts"]),
      { lenses: ["correctness"] },
      (event) => events.push(event as Record<string, unknown>),
      {
        concurrency: 1,
        batches: [createDiffForFiles(["src/a.ts"]), createDiffForFiles(["src/b.ts"])],
      },
    );

    expect(events.find((event) => event.type === "orchestrator_complete")).toMatchObject({
      filesAnalyzed: 1,
      batchesAnalyzed: 1,
      batchesPlanned: 2,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lensStats[0]).toMatchObject({
      status: "success",
      errorCode: "MODEL_ERROR",
    });
    expect(events.filter((event) => event.type === "agent_error")).toHaveLength(0);
    expect(result.value.lensStats).toContainEqual(expect.objectContaining({ lensId: "synthesis" }));
  });

  it("counts a batch as analyzed only when every reporting lens completed it", async () => {
    const events: Array<Record<string, unknown>> = [];
    const client = makeClient([
      ok({ issues: [] }),
      ok({ issues: [] }),
      ok({ issues: [] }),
      err({ code: "MODEL_ERROR", message: "Model failed" }),
    ]);

    await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts", "src/b.ts"]),
      { lenses: ["correctness", "security"] },
      (event) => events.push(event as Record<string, unknown>),
      {
        concurrency: 1,
        batches: [createDiffForFiles(["src/a.ts"]), createDiffForFiles(["src/b.ts"])],
      },
    );

    expect(events.find((event) => event.type === "orchestrator_complete")).toMatchObject({
      filesAnalyzed: 1,
      batchesAnalyzed: 1,
      batchesPlanned: 2,
    });
  });

  it("reports full coverage on a clean batched run", async () => {
    const events: Array<Record<string, unknown>> = [];
    const client = makeClient([ok({ issues: [] }), ok({ issues: [] })]);

    await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts", "src/b.ts"]),
      { lenses: ["correctness"] },
      (event) => events.push(event as Record<string, unknown>),
      {
        concurrency: 1,
        batches: [createDiffForFiles(["src/a.ts"]), createDiffForFiles(["src/b.ts"])],
      },
    );

    expect(events.find((event) => event.type === "orchestrator_complete")).toMatchObject({
      filesAnalyzed: 2,
      batchesAnalyzed: 2,
      batchesPlanned: 2,
    });
  });

  it("reports zero coverage when every lens failed", async () => {
    const events: Array<Record<string, unknown>> = [];
    const client = makeClient([err({ code: "MODEL_ERROR", message: "Model failed" })]);

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts", "src/b.ts"]),
      { lenses: ["correctness"] },
      (event) => events.push(event as Record<string, unknown>),
      {
        concurrency: 1,
        batches: [createDiffForFiles(["src/a.ts"]), createDiffForFiles(["src/b.ts"])],
      },
    );

    expect(events.find((event) => event.type === "orchestrator_complete")).toMatchObject({
      filesAnalyzed: 0,
      batchesAnalyzed: 0,
      batchesPlanned: 2,
    });
    expect(result.ok).toBe(false);
  });

  it("completes a review whose only lens found nothing before a batch failed", async () => {
    const client = makeClient([
      ok({ issues: [] }),
      err({ code: "MODEL_ERROR", message: "Model failed" }),
    ]);

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts", "src/b.ts"]),
      { lenses: ["correctness"] },
      () => {},
      {
        concurrency: 1,
        batches: [createDiffForFiles(["src/a.ts"]), createDiffForFiles(["src/b.ts"])],
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lensStats[0]).toMatchObject({
      lensId: "correctness",
      status: "success",
      issueCount: 0,
      errorCode: "MODEL_ERROR",
    });
    expect(result.value.lensStats).toContainEqual(expect.objectContaining({ lensId: "synthesis" }));
  });

  it("hands synthesis the findings of a partial lens's completed batches", async () => {
    const prompts: string[] = [];
    const queue: Array<Result<unknown, AIError>> = [
      ok({
        issues: [
          makeIssue({
            id: "cross-1",
            file: "file-1",
            title: "Schema changed without its consumer",
          }),
        ],
      }),
      err({ code: "MODEL_ERROR", message: "Model failed" }),
      ok({ issues: [] }),
    ];
    const client: AIClient = {
      provider: "openrouter",
      generate: async <T extends z.ZodType>(prompt: string, schema: T) => {
        prompts.push(prompt);
        const next = queue.shift();
        if (!next?.ok) return err({ code: "MODEL_ERROR", message: "Model failed" });
        return ok({ data: schema.parse(next.value) as z.output<T> });
      },
    };

    await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts", "src/b.ts"]),
      { lenses: ["correctness"] },
      () => {},
      {
        concurrency: 1,
        batches: [createDiffForFiles(["src/a.ts"]), createDiffForFiles(["src/b.ts"])],
      },
    );

    expect(prompts).toHaveLength(3);
    expect(prompts[2]).toContain("Schema changed without its consumer");
  });

  it("stops dispatching the remaining lenses when a partial lens exhausts the budget", async () => {
    const client = makeClient([
      ok({ issues: [makeIssue({ id: "issue-1", file: "file-1" })] }),
      budgetExhaustedError(),
    ]);
    const generate = vi.spyOn(client, "generate");

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts", "src/b.ts"]),
      { lenses: ["correctness", "security"] },
      () => {},
      {
        concurrency: 1,
        batches: [createDiffForFiles(["src/a.ts"]), createDiffForFiles(["src/b.ts"])],
      },
    );

    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lensStats).toMatchObject([
      { lensId: "correctness", status: "success", errorCode: "STREAM_ERROR" },
      {
        lensId: "security",
        status: "failed",
        errorCode: "BUDGET_EXHAUSTED",
        errorMessage: "Not dispatched — the review budget was exhausted.",
      },
    ]);
    expect(result.value.lensStats.some((stat) => stat.lensId === "synthesis")).toBe(false);
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
  ])("bounds in-flight AI calls to a concurrency of %i across three lenses", async (concurrency) => {
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
        return ok({ data: schema.parse({ issues: [] }) as z.output<T> });
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
