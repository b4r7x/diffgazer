import type { Result } from "@diffgazer/core/result";
import { err, ok } from "@diffgazer/core/result";
import type { SettingsConfig } from "@diffgazer/core/schemas/config";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import type { AIClient, AIError } from "../../../shared/lib/ai/types.js";
import { makeFileDiff, makeIssue, makeParsedDiff } from "../../../shared/lib/testing/factories.js";
import { resolveReviewDefaults } from "../pipeline.js";
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
      {},
      (event) => events.push({ type: event.type }),
      { concurrency: 2 },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NO_DIFF");
    expect(events).toEqual([]);
  });

  it("falls back from an empty explicit lens list and invokes one correctness analysis", async () => {
    const client = makeClient([]);
    const generate = vi.spyOn(client, "generate");
    const events: Array<Record<string, unknown>> = [];

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts"]),
      { lenses: [] },
      (event) => events.push(event as Record<string, unknown>),
      { concurrency: 4 },
    );

    expect(result.ok).toBe(true);
    expect(generate).toHaveBeenCalledOnce();
    expect(events.filter((event) => event.type === "agent_queued")).toHaveLength(1);
    if (result.ok) {
      expect(result.value.lensStats.map((lens) => lens.lensId)).toEqual(["correctness"]);
    }
  });

  it("canonicalizes duplicate lens ids before queuing or invoking agents", async () => {
    const client = makeClient([]);
    const generate = vi.spyOn(client, "generate");
    const events: Array<Record<string, unknown>> = [];

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts"]),
      { lenses: ["correctness", "correctness", "security", "correctness", "security"] },
      (event) => events.push(event as Record<string, unknown>),
      { concurrency: 4 },
    );

    expect(result.ok).toBe(true);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(events.filter((event) => event.type === "agent_queued")).toHaveLength(2);
    if (result.ok) {
      expect(result.value.lensStats.map((lens) => lens.lensId)).toEqual([
        "correctness",
        "security",
      ]);
    }
  });

  it("uses validated settings defaults when explicit lenses are empty", () => {
    const settings: SettingsConfig = {
      theme: "auto",
      defaultLenses: ["security"],
      defaultProfile: null,
      severityThreshold: "low",
      secretsStorage: null,
      agentExecution: "sequential",
    };

    expect(resolveReviewDefaults({ lensIds: [], settings }).activeLenses).toEqual(["security"]);
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

  it("keeps successful lens output and reports failed lenses", async () => {
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
      expect(result.value.failedLenses).toEqual([
        expect.objectContaining({ lensId: "security", errorCode: "MODEL_ERROR" }),
      ]);
    }
  });

  it("returns an error when every lens fails unless partialOnAllFailed is enabled", async () => {
    const diff = createDiffForFiles(["src/a.ts"]);

    const failed = await orchestrateReview(
      makeClient([
        err({ code: "MODEL_ERROR", message: "Correctness failed" }),
        err({ code: "NETWORK_ERROR", message: "Security failed" }),
      ]),
      diff,
      { lenses: ["correctness", "security"] },
      () => {},
      { concurrency: 2 },
    );

    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.error.code).toBe("NETWORK_ERROR");

    const partial = await orchestrateReview(
      makeClient([
        err({ code: "MODEL_ERROR", message: "Correctness failed" }),
        err({ code: "NETWORK_ERROR", message: "Security failed" }),
      ]),
      diff,
      { lenses: ["correctness", "security"] },
      () => {},
      { concurrency: 2, partialOnAllFailed: true },
    );

    expect(partial.ok).toBe(true);
    if (partial.ok) {
      expect(partial.value.issues).toEqual([]);
      expect(partial.value.failedLenses.map((lens) => lens.lensId)).toEqual([
        "correctness",
        "security",
      ]);
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
        return ok(schema.parse({ issues: [] }) as z.output<T>);
      },
    };

    const result = await orchestrateReview(
      client,
      createDiffForFiles(["src/a.ts"]),
      { lenses: ["correctness", "security", "performance"] },
      () => {},
      { concurrency: 1, partialOnAllFailed: true, signal: controller.signal },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.lensStats).toHaveLength(3);
      expect(result.value.failedLenses.map((lens) => lens.lensId)).toEqual([
        "security",
        "performance",
      ]);
      expect(result.value.failedLenses.every((lens) => lens.errorCode === "CANCELLED")).toBe(true);
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
      { concurrency: 1, partialOnAllFailed: true },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.failedLenses[0]?.errorCode).toBe("INTERNAL_ERROR");
    }
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
    expect(result.value.droppedIncompleteProviderIssues).toBe(1);
    expect(events.filter((event) => event.type === "issue_found")).toHaveLength(1);
    expect(events.find((event) => event.type === "orchestrator_complete")).toMatchObject({
      totalIssues: 1,
      droppedDuplicates: 0,
      droppedIncompleteProviderIssues: 1,
    });
  });
});
