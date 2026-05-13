import { describe, it, expect } from "vitest";
import {
  filterDiffByFiles,
  generateExecutiveSummary,
  generateReport,
  resolveGitDiff,
} from "./pipeline.js";
import type { createGitService } from "../../shared/lib/git/service.js";
import type { ParsedDiff } from "../../shared/lib/diff/types.js";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";

const makeFile = (filePath: string, additions = 1, deletions = 0) => ({
  filePath,
  previousPath: null,
  operation: "modify" as const,
  hunks: [],
  rawDiff: "",
  stats: { additions, deletions, sizeBytes: 100 },
  fileMode: "modified" as const,
});

const makeParsedDiff = (files: ReturnType<typeof makeFile>[]): ParsedDiff => ({
  files,
  totalStats: {
    filesChanged: files.length,
    additions: files.reduce((s, f) => s + f.stats.additions, 0),
    deletions: files.reduce((s, f) => s + f.stats.deletions, 0),
    totalSizeBytes: files.reduce((s, f) => s + f.stats.sizeBytes, 0),
  },
});

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
    getDiff: async () => diff,
  } as ReturnType<typeof createGitService>;
}

const makeIssue = (
  id: string,
  file: string,
  severity: "blocker" | "high" | "medium" | "low" | "nit",
): ReviewIssue =>
  ({
    id,
    file,
    severity,
    category: "correctness",
    title: `Issue ${id}`,
    rationale: "test",
    recommendation: "fix",
    suggested_patch: null,
    confidence: 0.9,
    symptom: "broken",
    whyItMatters: "matters",
    evidence: [],
    line_start: 1,
    line_end: 5,
  }) as ReviewIssue;

describe("filterDiffByFiles", () => {
  const parsed = makeParsedDiff([
    makeFile("src/index.ts"),
    makeFile("src/utils.ts"),
    makeFile("README.md"),
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
      emit: async (event) => { events.push(event); },
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
      emit: async (event) => { events.push(event); },
      reviewId: "review-1",
    });

    expect(result.ok).toBe(false);
    expect(events).toMatchObject([{ type: "step_start", step: "diff" }]);
  });
});

describe("generateExecutiveSummary", () => {
  it("formats issue counts, file counts, severity breakdown, and orchestration summary", () => {
    const issues = [
      makeIssue("1", "a.ts", "high"),
      makeIssue("2", "a.ts", "high"),
      makeIssue("3", "b.ts", "low"),
    ];
    const summary = generateExecutiveSummary(issues, "All lenses passed.");

    expect(summary).toContain("Found 3 issues across 2 files.");
    expect(summary).toContain("- high: 2");
    expect(summary).toContain("- low: 1");
    expect(summary).toContain("All lenses passed.");
  });

  it("uses singular wording without adding empty orchestration spacing", () => {
    const issues = [makeIssue("1", "a.ts", "high")];
    const summary = generateExecutiveSummary(issues, "");

    expect(summary).toContain("Found 1 issue across 1 file.");
    expect(summary.endsWith("\n\n")).toBe(false);
  });
});

describe("generateReport", () => {
  it("returns generated summary and original issues", () => {
    const issues = [makeIssue("1", "a.ts", "high")];
    const report = generateReport(issues, "summary text");

    expect(report.issues).toBe(issues);
    expect(report.summary).toContain("Found 1 issue");
  });
});
