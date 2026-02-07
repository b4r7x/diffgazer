import { describe, it, expect, vi, beforeEach } from "vitest";
import { ok, err } from "@stargazer/core/result";
import type { Lens, LensId, ReviewIssue } from "@stargazer/schemas/review";
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
