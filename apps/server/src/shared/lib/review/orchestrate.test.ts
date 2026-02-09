import { describe, it, expect, vi, beforeEach } from "vitest";
import { ok, err } from "@diffgazer/core/result";
import type { Lens, LensId, ReviewIssue } from "@diffgazer/schemas/review";
import type { ParsedDiff } from "../diff/types.js";
import type { AIClient } from "../ai/types.js";
import { orchestrateReview } from "./orchestrate.js";

const { mockGetLenses, mockRunLensAnalysis } = vi.hoisted(() => ({
  mockGetLenses: vi.fn(),
  mockRunLensAnalysis: vi.fn(),
}));

vi.mock("./lenses.js", () => ({
  getLenses: mockGetLenses,
}));

vi.mock("./analysis.js", () => ({
  runLensAnalysis: mockRunLensAnalysis,
}));

const makeLens = (id: LensId): Lens => ({
  id,
  name: `${id} lens`,
  description: `${id} description`,
  systemPrompt: `Prompt for ${id}`,
  severityRubric: {
    blocker: "blocker",
    high: "high",
    medium: "medium",
    low: "low",
    nit: "nit",
  },
});

const makeIssue = (id: string, file: string): ReviewIssue => ({
  id,
  severity: "high",
  category: "correctness",
  title: `Issue ${id}`,
  file,
  line_start: 1,
  line_end: 1,
  rationale: "Test rationale",
  recommendation: "Test recommendation",
  suggested_patch: null,
  confidence: 0.9,
  symptom: "Test symptom",
  whyItMatters: "Test impact",
  evidence: [
    {
      type: "code",
      title: "Test evidence",
      sourceId: "test-evidence",
      file,
      excerpt: "const value = 1;",
    },
  ],
});

const makeDiff = (files: string[]): ParsedDiff => ({
  files: files.map((filePath) => ({
    filePath,
    previousPath: null,
    operation: "modify",
    hunks: [],
    rawDiff: "",
    stats: { additions: 1, deletions: 0, sizeBytes: 10 },
  })),
  totalStats: {
    filesChanged: files.length,
    additions: files.length,
    deletions: 0,
    totalSizeBytes: files.length * 10,
  },
});

const client = {} as AIClient;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("orchestrateReview", () => {
  it("returns NO_DIFF when no files changed", async () => {
    const events: Array<{ type: string }> = [];
    const result = await orchestrateReview(
      client,
      makeDiff([]),
      {},
      (event) => events.push({ type: event.type }),
      { concurrency: 2 },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NO_DIFF");
    }
    expect(events).toHaveLength(0);
  });

  it("caps orchestrator concurrency to available lenses", async () => {
    const events: Array<{ type: string; concurrency?: number; position?: number }> = [];
    const lenses = [makeLens("correctness"), makeLens("security")];

    mockGetLenses.mockReturnValue(lenses);
    mockRunLensAnalysis.mockImplementation(async (_clientArg, lensArg: Lens) =>
      ok({
        lensId: lensArg.id,
        lensName: lensArg.name,
        summary: `${lensArg.id} summary`,
        issues: [],
      }),
    );

    const result = await orchestrateReview(
      client,
      makeDiff(["src/a.ts"]),
      { lenses: ["correctness", "security"] },
      (event) => events.push(event),
      { concurrency: 10 },
    );

    expect(result.ok).toBe(true);
    expect(mockRunLensAnalysis).toHaveBeenCalledTimes(2);

    const orchestratorStart = events.find((event) => event.type === "orchestrator_start");
    expect(orchestratorStart?.concurrency).toBe(2);

    const queuedEvents = events.filter((event) => event.type === "agent_queued");
    expect(queuedEvents).toHaveLength(2);
    expect(queuedEvents.map((event) => event.position)).toEqual([1, 2]);
  });

  it("keeps successful issues and reports failed lenses", async () => {
    const lenses = [makeLens("correctness"), makeLens("security")];
    mockGetLenses.mockReturnValue(lenses);
    mockRunLensAnalysis
      .mockResolvedValueOnce(
        ok({
          lensId: "correctness",
          lensName: "Correctness lens",
          summary: "Found correctness issues",
          issues: [makeIssue("issue-1", "src/a.ts")],
        }),
      )
      .mockResolvedValueOnce(err({ code: "MODEL_ERROR", message: "Second lens failed" }));

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
        expect.objectContaining({
          lensId: "security",
          errorCode: "MODEL_ERROR",
        }),
      ]);
      expect(result.value.summary).toContain("Partial analysis:");
    }
  });

  it("should return err when all lenses fail and partialOnAllFailed is false", async () => {
    const lenses = [makeLens("correctness"), makeLens("security")];
    mockGetLenses.mockReturnValue(lenses);
    mockRunLensAnalysis
      .mockResolvedValueOnce(err({ code: "MODEL_ERROR", message: "Correctness failed" }))
      .mockResolvedValueOnce(err({ code: "NETWORK_ERROR", message: "Security failed" }));

    const result = await orchestrateReview(
      client,
      makeDiff(["src/a.ts"]),
      { lenses: ["correctness", "security"] },
      () => {},
      { concurrency: 2 },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NETWORK_ERROR");
    }
  });

  it("should emit orchestrator_complete event with summary and stats", async () => {
    const events: Array<Record<string, unknown>> = [];
    const lenses = [makeLens("correctness")];
    mockGetLenses.mockReturnValue(lenses);
    mockRunLensAnalysis.mockResolvedValueOnce(
      ok({
        lensId: "correctness",
        lensName: "Correctness lens",
        summary: "All good",
        issues: [makeIssue("issue-1", "src/a.ts")],
      }),
    );

    await orchestrateReview(
      client,
      makeDiff(["src/a.ts"]),
      { lenses: ["correctness"] },
      (event) => events.push(event as Record<string, unknown>),
      { concurrency: 1 },
    );

    const completeEvent = events.find((e) => e.type === "orchestrator_complete");
    expect(completeEvent).toBeDefined();
    expect(completeEvent!.totalIssues).toBe(1);
    expect(completeEvent!.filesAnalyzed).toBe(1);
    expect(completeEvent!.summary).toContain("All good");
    expect(completeEvent!.lensStats).toHaveLength(1);
  });

  it("should deduplicate and sort issues from multiple lenses", async () => {
    const lenses = [makeLens("correctness"), makeLens("security")];
    mockGetLenses.mockReturnValue(lenses);

    const sharedIssue = makeIssue("dup-1", "src/a.ts");
    const uniqueIssue = { ...makeIssue("unique-1", "src/b.ts"), severity: "low" as const };

    mockRunLensAnalysis
      .mockResolvedValueOnce(
        ok({
          lensId: "correctness",
          lensName: "Correctness lens",
          summary: "Correctness summary",
          issues: [sharedIssue],
        }),
      )
      .mockResolvedValueOnce(
        ok({
          lensId: "security",
          lensName: "Security lens",
          summary: "Security summary",
          // Same file, same line_start, same title prefix → should be deduped
          issues: [{ ...sharedIssue, id: "dup-2" }, uniqueIssue],
        }),
      );

    const result = await orchestrateReview(
      client,
      makeDiff(["src/a.ts", "src/b.ts"]),
      { lenses: ["correctness", "security"] },
      () => {},
      { concurrency: 2 },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Dedup removes one of the shared issues, leaves 2 total
      expect(result.value.issues).toHaveLength(2);
      // Sorted by severity: high before low
      expect(result.value.issues[0]!.severity).toBe("high");
      expect(result.value.issues[1]!.severity).toBe("low");
    }
  });

  it("should execute lenses serially when concurrency is 1", async () => {
    const executionOrder: string[] = [];
    const lenses = [makeLens("correctness"), makeLens("security")];
    mockGetLenses.mockReturnValue(lenses);
    mockRunLensAnalysis.mockImplementation(async (_clientArg, lensArg: Lens) => {
      executionOrder.push(`start-${lensArg.id}`);
      // Small delay to detect parallelism
      await new Promise((r) => setTimeout(r, 10));
      executionOrder.push(`end-${lensArg.id}`);
      return ok({
        lensId: lensArg.id,
        lensName: lensArg.name,
        summary: `${lensArg.id} summary`,
        issues: [],
      });
    });

    await orchestrateReview(
      client,
      makeDiff(["src/a.ts"]),
      { lenses: ["correctness", "security"] },
      () => {},
      { concurrency: 1 },
    );

    // With concurrency 1, second lens starts only after first ends
    expect(executionOrder).toEqual([
      "start-correctness",
      "end-correctness",
      "start-security",
      "end-security",
    ]);
  });

  it("marks unstarted lenses as failed when aborted", async () => {
    const controller = new AbortController();
    const lenses = [
      makeLens("correctness"),
      makeLens("security"),
      makeLens("performance"),
    ];
    mockGetLenses.mockReturnValue(lenses);
    mockRunLensAnalysis.mockImplementation(async (_clientArg, lensArg: Lens) => {
      if (lensArg.id === "correctness") {
        controller.abort("cancel test");
      }
      return ok({
        lensId: lensArg.id,
        lensName: lensArg.name,
        summary: `${lensArg.id} summary`,
        issues: [],
      });
    });

    const result = await orchestrateReview(
      client,
      makeDiff(["src/a.ts"]),
      { lenses: ["correctness", "security", "performance"] },
      () => {},
      { concurrency: 1, partialOnAllFailed: true, signal: controller.signal },
    );

    expect(mockRunLensAnalysis).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Ensures unstarted slots are represented in output (no sparse holes).
      expect(result.value.lensStats).toHaveLength(3);
      expect(result.value.failedLenses.map((lens) => lens.lensId)).toEqual(
        expect.arrayContaining(["security", "performance"]),
      );
    }
  });
});
