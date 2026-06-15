import { err, ok } from "@diffgazer/core/result";
import type { SettingsConfig } from "@diffgazer/core/schemas/config";
import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { createGitService } from "../../shared/lib/git/service.js";
import { makeFileDiff, makeIssue, makeParsedDiff } from "../../shared/lib/testing/factories.js";
import { filterDiffByFiles, resolveGitDiff } from "./diff.js";

const saveReview = vi.fn();
// Boundary mock: filesystem storage - saveReview is the durable-write boundary finalizeReview gates the report step on.
vi.mock("./storage/reviews.js", () => ({
  saveReview: (...args: unknown[]) => saveReview(...args),
}));

import { finalizeReview, resolveReviewDefaults } from "./pipeline.js";
import { generateExecutiveSummary, generateReport } from "./summary.js";

function makePipelineFile(filePath: string, additions = 1, deletions = 0) {
  return makeFileDiff({
    filePath,
    rawDiff: "",
    stats: { additions, deletions, sizeBytes: 100 },
  });
}

const TWO_FILE_DIFF = [
  "diff --git a/src/index.ts b/src/index.ts",
  "index 1111111..2222222 100644",
  "--- a/src/index.ts",
  "+++ b/src/index.ts",
  "@@ -1 +1 @@",
  "-old",
  "+new",
  "diff --git a/README.md b/README.md",
  "index 3333333..4444444 100644",
  "--- a/README.md",
  "+++ b/README.md",
  "@@ -1 +1 @@",
  "-old",
  "+new",
  "",
].join("\n");

function makeGitService(diff: string): ReturnType<typeof createGitService> {
  return {
    getDiff: async () => ok(diff),
  } as ReturnType<typeof createGitService>;
}

const makePipelineIssue = (
  id: string,
  file: string,
  severity: "blocker" | "high" | "medium" | "low" | "nit",
) =>
  makeIssue({
    id,
    file,
    severity,
    title: `Issue ${id}`,
    rationale: "test",
    recommendation: "fix",
    symptom: "broken",
    whyItMatters: "matters",
    line_start: 1,
    line_end: 5,
  });

describe("resolveReviewDefaults", () => {
  const baseSettings: SettingsConfig = {
    theme: "auto",
    secretsStorage: null,
    defaultLenses: ["correctness", "security"],
    defaultProfile: null,
    severityThreshold: "low",
    agentExecution: "sequential",
  };

  it("applies defaultProfile from settings when no explicit profile is provided", () => {
    const defaults = resolveReviewDefaults({
      settings: { ...baseSettings, defaultProfile: "strict" },
    });

    expect(defaults.effectiveProfileId).toBe("strict");
    expect(defaults.activeLenses).toEqual(["correctness", "security", "tests"]);
  });

  it("applies severityThreshold from settings when the profile filter is looser", () => {
    const defaults = resolveReviewDefaults({
      settings: { ...baseSettings, defaultProfile: "perf", severityThreshold: "high" },
    });

    expect(defaults.severityFilter).toEqual({ minSeverity: "high" });
  });
});

describe("filterDiffByFiles", () => {
  const parsed = makeParsedDiff([
    makePipelineFile("src/index.ts"),
    makePipelineFile("src/utils.ts"),
    makePipelineFile("README.md"),
  ]);

  it("returns all files when no filter is provided", () => {
    const result = filterDiffByFiles(parsed, []);
    expect(result.files).toHaveLength(3);
  });

  it("matches normalized paths and recalculates totals for included files", () => {
    const result = filterDiffByFiles(parsed, ["./src/index.ts", "src/utils.ts"]);
    expect(result.files).toHaveLength(2);
    expect(result.files.map((f) => f.filePath)).toEqual(["src/index.ts", "src/utils.ts"]);
    expect(result.totalStats).toEqual({
      filesChanged: 2,
      additions: 2,
      deletions: 0,
      totalSizeBytes: 200,
    });
  });

  it("returns empty totals when no files match", () => {
    const result = filterDiffByFiles(parsed, ["nonexistent.ts"]);
    expect(result.files).toHaveLength(0);
    expect(result.totalStats.filesChanged).toBe(0);
  });
});

describe("resolveGitDiff", () => {
  it("emits review_started after file filtering", async () => {
    const events: unknown[] = [];

    const result = await resolveGitDiff({
      gitService: makeGitService(TWO_FILE_DIFF),
      mode: "unstaged",
      files: ["src/index.ts"],
      emit: async (event) => {
        events.push(event);
      },
      reviewId: "review-1",
    });

    expect(result.ok).toBe(true);
    expect(events).toMatchObject([
      { type: "step_start", step: "diff" },
      { type: "step_complete", step: "diff" },
      { type: "review_started", filesTotal: 1 },
    ]);
  });

  it("does not emit review_started when file filtering removes every diff file", async () => {
    const events: unknown[] = [];

    const result = await resolveGitDiff({
      gitService: makeGitService(TWO_FILE_DIFF),
      mode: "unstaged",
      files: ["missing.ts"],
      emit: async (event) => {
        events.push(event);
      },
      reviewId: "review-1",
    });

    expect(result.ok).toBe(false);
    expect(events).toMatchObject([{ type: "step_start", step: "diff" }]);
  });
});

describe("generateExecutiveSummary", () => {
  it("formats issue counts, file counts, severity breakdown, and orchestration summary", () => {
    const issues = [
      makePipelineIssue("1", "a.ts", "high"),
      makePipelineIssue("2", "a.ts", "high"),
      makePipelineIssue("3", "b.ts", "low"),
    ];
    const summary = generateExecutiveSummary(issues, "All lenses passed.");

    expect(summary).toContain("Found 3 issues across 2 files.");
    expect(summary).toContain("All lenses passed.");
    // The breakdown lists every severity in REVIEW_SEVERITY order (most to least
    // severe), including zero counts — locking the iteration order after dropping
    // the Object.entries+sort+cast path.
    expect(summary).toContain(
      [
        "Severity breakdown:",
        "- blocker: 0",
        "- high: 2",
        "- medium: 0",
        "- low: 1",
        "- nit: 0",
      ].join("\n"),
    );
  });

  it("uses singular wording without adding empty orchestration spacing", () => {
    const issues = [makePipelineIssue("1", "a.ts", "high")];
    const summary = generateExecutiveSummary(issues, "");

    expect(summary).toContain("Found 1 issue across 1 file.");
    expect(summary.endsWith("\n\n")).toBe(false);
  });
});

describe("generateReport", () => {
  it("returns generated summary and original issues", () => {
    const issues = [makePipelineIssue("1", "a.ts", "high")];
    const report = generateReport(issues, "summary text");

    expect(report.issues).toBe(issues);
    expect(report.summary).toContain("Found 1 issue");
  });
});

describe("finalizeReview", () => {
  afterEach(() => {
    saveReview.mockReset();
  });

  function makeFinalizeGitService(): ReturnType<typeof createGitService> {
    return {
      getStatus: async () =>
        ok({
          isGitRepo: true,
          branch: "main",
          remoteBranch: null,
          ahead: 0,
          behind: 0,
          files: { staged: [], unstaged: [], untracked: [] },
          hasChanges: false,
          conflicted: [],
        }),
    } as unknown as ReturnType<typeof createGitService>;
  }

  function runFinalize(events: FullReviewStreamEvent[]) {
    return finalizeReview({
      outcome: { issues: [makePipelineIssue("1", "a.ts", "high")], summary: "one issue" },
      gitService: makeFinalizeGitService(),
      emit: async (event) => {
        events.push(event);
      },
      reviewId: "review-1",
      projectPath: "/project",
      mode: "unstaged",
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      activeLenses: ["correctness"],
      startTime: Date.now(),
    });
  }

  function stepNames(events: FullReviewStreamEvent[], type: string): string[] {
    return events
      .filter(
        (e): e is Extract<FullReviewStreamEvent, { type: "step_start" | "step_complete" }> =>
          e.type === type && "step" in e,
      )
      .map((e) => e.step);
  }

  it("aborts with INTERNAL_ERROR and emits no report-complete when the save fails", async () => {
    saveReview.mockResolvedValue(err({ code: "WRITE_ERROR", message: "disk full" }));
    const events: FullReviewStreamEvent[] = [];

    const result = await runFinalize(events);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ kind: "review_abort", code: "INTERNAL_ERROR" });
    // The report step starts, but a save failure must never complete it — so the
    // client's View Results gate (and the absence of a terminal complete) holds.
    expect(stepNames(events, "step_start")).toContain("report");
    expect(stepNames(events, "step_complete")).not.toContain("report");
  });

  it("completes the report step only after a successful save", async () => {
    let savedBeforeReportComplete = false;
    saveReview.mockImplementation(async () => {
      // At save time the report step has started but must not yet be complete.
      savedBeforeReportComplete = capturedEvents.every(
        (e) => !(e.type === "step_complete" && "step" in e && e.step === "report"),
      );
      return ok({ id: "review-1" });
    });
    const capturedEvents: FullReviewStreamEvent[] = [];

    const result = await runFinalize(capturedEvents);

    expect(result.ok).toBe(true);
    expect(savedBeforeReportComplete).toBe(true);
    expect(stepNames(capturedEvents, "step_complete")).toContain("report");
  });
});
