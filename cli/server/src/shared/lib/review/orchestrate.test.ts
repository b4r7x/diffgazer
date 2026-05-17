import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok, err } from "@diffgazer/core/result";
import type { Result } from "@diffgazer/core/result";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import type { ParsedDiff } from "../diff/types.js";
import type { AIClient, AIError } from "../ai/types.js";
import { orchestrateReview } from "./orchestrate.js";
import { makeIssue } from "../testing/factories.js";
import type { z } from "zod";

const makeDiff = (files: string[]): ParsedDiff => ({
  files: files.map((filePath) => ({
    filePath,
    previousPath: null,
    operation: "modify",
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
  })),
  totalStats: {
    filesChanged: files.length,
    additions: files.length,
    deletions: files.length,
    totalSizeBytes: files.length * 80,
  },
});

function makeClient(results: Array<Result<unknown, AIError>>): AIClient {
  const queue = [...results];
  return {
    provider: "openrouter",
    generate: async <T extends z.ZodType>(_prompt: string, schema: T) => {
      const next = queue.shift();
      if (!next) {
        return ok(schema.parse({ summary: "No findings", issues: [] }) as z.output<T>);
      }
      if (!next.ok) return next;

      return ok(schema.parse(next.value) as z.output<T>);
    },
    generateStream: vi.fn(),
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
      makeDiff([]),
      {},
      (event) => events.push({ type: event.type }),
      { concurrency: 2 },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NO_DIFF");
    expect(events).toEqual([]);
  });

  it("returns sorted, deduplicated issues and complete orchestration metadata", async () => {
    const events: Array<Record<string, unknown>> = [];
    const sharedIssue = makeIssue({ id: "dup-1", file: "src/a.ts" });
    const lowIssue = makeIssue({ id: "low-1", file: "src/b.ts", severity: "low" });
    const client = makeClient([
      ok({ summary: "Correctness summary", issues: [sharedIssue] }),
      ok({ summary: "Security summary", issues: [{ ...sharedIssue, id: "dup-2" }, lowIssue] }),
    ]);

    const result = await orchestrateReview(
      client,
      makeDiff(["src/a.ts", "src/b.ts"]),
      { lenses: ["correctness", "security"] },
      (event) => events.push(event as Record<string, unknown>),
      { concurrency: 2 },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.issues.map((issue) => issue.id)).toEqual(["dup-1", "low-1"]);
      expect(result.value.issues.map((issue) => issue.severity)).toEqual(["high", "low"]);
      expect(result.value.summary).toContain("Correctness summary");
      expect(result.value.summary).toContain("Security summary");
      expect(result.value.lensStats).toMatchObject([
        { lensId: "correctness", issueCount: 1, status: "success" },
        { lensId: "security", issueCount: 2, status: "success" },
      ]);
    }

    expect(events.find((event) => event.type === "orchestrator_start")).toMatchObject({
      concurrency: 2,
    });
    expect(events.find((event) => event.type === "orchestrator_complete")).toMatchObject({
      totalIssues: 2,
      filesAnalyzed: 2,
    });
  });

  it("keeps successful lens output and reports failed lenses", async () => {
    const client = makeClient([
      ok({ summary: "Found correctness issues", issues: [makeIssue({ id: "issue-1", file: "src/a.ts" })] }),
      err({ code: "MODEL_ERROR", message: "Second lens failed" }),
    ]);

    const result = await orchestrateReview(
      client,
      makeDiff(["src/a.ts"]),
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
      expect(result.value.summary).toContain("Partial analysis:");
    }
  });

  it("returns an error when every lens fails unless partialOnAllFailed is enabled", async () => {
    const diff = makeDiff(["src/a.ts"]);

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
      expect(partial.value.failedLenses.map((lens) => lens.lensId)).toEqual(["correctness", "security"]);
    }
  });

  it("honors the severity filter from review options", async () => {
    const client = makeClient([
      ok({
        summary: "Mixed severities",
        issues: [
          makeIssue({ id: "high-1", file: "src/a.ts", severity: "high" }),
          makeIssue({ id: "low-1", file: "src/a.ts", severity: "low" }),
        ],
      }),
    ]);

    const result = await orchestrateReview(
      client,
      makeDiff(["src/a.ts"]),
      { lenses: ["correctness"], filter: { minSeverity: "high" } },
      () => {},
      { concurrency: 1 },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.issues.map((issue) => issue.id)).toEqual(["high-1"]);
    }
  });

  it("marks unstarted lenses as failed when aborted", async () => {
    const controller = new AbortController();
    const client: AIClient = {
      provider: "openrouter",
      generate: async <T extends z.ZodType>(_prompt: string, schema: T) => {
        controller.abort("cancel test");
        return ok(schema.parse({ summary: "Stopped", issues: [] }) as z.output<T>);
      },
      generateStream: vi.fn(),
    };

    const result = await orchestrateReview(
      client,
      makeDiff(["src/a.ts"]),
      { lenses: ["correctness", "security", "performance"] },
      () => {},
      { concurrency: 1, partialOnAllFailed: true, signal: controller.signal },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.lensStats).toHaveLength(3);
      expect(result.value.failedLenses.map((lens) => lens.lensId)).toEqual(["security", "performance"]);
    }
  });
});
