import { describe, it, expect } from "vitest";
import {
  filterDiffByFiles,
  generateExecutiveSummary,
  generateReport,
} from "./pipeline.js";
import type { ParsedDiff } from "../../shared/lib/diff/types.js";
import type { ReviewIssue } from "@diffgazer/schemas/review";

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

  it("should return all files when filter list is empty", () => {
    const result = filterDiffByFiles(parsed, []);
    expect(result.files).toHaveLength(3);
  });

  it("should include only matching files", () => {
    const result = filterDiffByFiles(parsed, ["src/index.ts"]);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]!.filePath).toBe("src/index.ts");
  });

  it("should exclude non-matching files", () => {
    const result = filterDiffByFiles(parsed, ["src/index.ts", "src/utils.ts"]);
    expect(result.files).toHaveLength(2);
    expect(result.files.map((f) => f.filePath)).not.toContain("README.md");
  });

  it("should normalize ./ prefix in filter paths", () => {
    const result = filterDiffByFiles(parsed, ["./src/index.ts"]);
    expect(result.files).toHaveLength(1);
  });

  it("should recalculate totalStats for filtered files", () => {
    const result = filterDiffByFiles(parsed, ["src/index.ts"]);
    expect(result.totalStats.filesChanged).toBe(1);
    expect(result.totalStats.totalSizeBytes).toBe(100);
  });

  it("should return empty when no files match", () => {
    const result = filterDiffByFiles(parsed, ["nonexistent.ts"]);
    expect(result.files).toHaveLength(0);
    expect(result.totalStats.filesChanged).toBe(0);
  });
});

describe("generateExecutiveSummary", () => {
  it("should format summary with issue count and file count", () => {
    const issues = [
      makeIssue("1", "a.ts", "high"),
      makeIssue("2", "b.ts", "low"),
    ];
    const summary = generateExecutiveSummary(issues, "");

    expect(summary).toContain("Found 2 issues across 2 files.");
  });

  it("should use singular for 1 issue across 1 file", () => {
    const issues = [makeIssue("1", "a.ts", "high")];
    const summary = generateExecutiveSummary(issues, "");

    expect(summary).toContain("Found 1 issue across 1 file.");
  });

  it("should include severity breakdown", () => {
    const issues = [
      makeIssue("1", "a.ts", "high"),
      makeIssue("2", "a.ts", "high"),
      makeIssue("3", "b.ts", "low"),
    ];
    const summary = generateExecutiveSummary(issues, "");

    expect(summary).toContain("- high: 2");
    expect(summary).toContain("- low: 1");
  });

  it("should append orchestration summary when provided", () => {
    const issues = [makeIssue("1", "a.ts", "high")];
    const summary = generateExecutiveSummary(issues, "All lenses passed.");

    expect(summary).toContain("All lenses passed.");
  });

  it("should not append orchestration summary when empty", () => {
    const issues = [makeIssue("1", "a.ts", "high")];
    const summary = generateExecutiveSummary(issues, "");

    // Should not have trailing blank lines for empty orchestration
    expect(summary.endsWith("\n\n")).toBe(false);
  });
});

describe("generateReport", () => {
  it("should return summary and issues", () => {
    const issues = [makeIssue("1", "a.ts", "high")];
    const report = generateReport(issues, "summary text");

    expect(report.issues).toBe(issues);
    expect(report.summary).toContain("Found 1 issue");
  });
});

