import { describe, it, expect } from "vitest";
import {
  deduplicateIssues,
  sortIssuesBySeverity,
  filterIssuesByMinSeverity,
  ensureIssueEvidence,
  validateIssueCompleteness,
} from "./issues.js";
import type { ReviewIssue } from "@diffgazer/schemas/review";
import type { ParsedDiff, FileDiff, DiffHunk } from "../diff/types.js";

function makeIssue(overrides: Partial<ReviewIssue> = {}): ReviewIssue {
  return {
    id: "test_1",
    severity: "medium",
    category: "correctness",
    title: "Test Issue",
    file: "test.ts",
    line_start: 10,
    line_end: 15,
    rationale: "Something is wrong",
    recommendation: "Fix it",
    suggested_patch: null,
    confidence: 0.8,
    symptom: "Observable problem",
    whyItMatters: "It matters",
    evidence: [],
    ...overrides,
  };
}

function makeDiff(files: FileDiff[] = []): ParsedDiff {
  return {
    files,
    totalStats: { filesChanged: files.length, additions: 0, deletions: 0, totalSizeBytes: 0 },
  };
}

function makeFileDiff(overrides: Partial<FileDiff> = {}): FileDiff {
  return {
    filePath: "test.ts",
    previousPath: null,
    operation: "modify",
    hunks: [],
    rawDiff: "",
    stats: { additions: 0, deletions: 0, sizeBytes: 0 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// deduplicateIssues
// ---------------------------------------------------------------------------

describe("deduplicateIssues", () => {
  it("should return empty array for empty input", () => {
    expect(deduplicateIssues([])).toEqual([]);
  });

  it("should keep unique issues unchanged", () => {
    const issues = [
      makeIssue({ id: "1", file: "a.ts", line_start: 1, title: "Issue A" }),
      makeIssue({ id: "2", file: "b.ts", line_start: 1, title: "Issue B" }),
    ];
    const result = deduplicateIssues(issues);

    expect(result).toHaveLength(2);
  });

  it("should deduplicate by composite key (file + line + title prefix)", () => {
    const issues = [
      makeIssue({ id: "1", file: "a.ts", line_start: 10, title: "Null reference error", severity: "medium" }),
      makeIssue({ id: "2", file: "a.ts", line_start: 10, title: "Null reference error", severity: "low" }),
    ];
    const result = deduplicateIssues(issues);

    expect(result).toHaveLength(1);
  });

  it("should keep the higher severity issue when deduplicating", () => {
    const issues = [
      makeIssue({ id: "1", file: "a.ts", line_start: 10, title: "Null ref", severity: "low" }),
      makeIssue({ id: "2", file: "a.ts", line_start: 10, title: "Null ref", severity: "high" }),
    ];
    const result = deduplicateIssues(issues);

    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe("high");
  });

  it("should treat different files as different issues", () => {
    const issues = [
      makeIssue({ id: "1", file: "a.ts", line_start: 10, title: "Same title" }),
      makeIssue({ id: "2", file: "b.ts", line_start: 10, title: "Same title" }),
    ];
    const result = deduplicateIssues(issues);

    expect(result).toHaveLength(2);
  });

  it("should treat different lines as different issues", () => {
    const issues = [
      makeIssue({ id: "1", file: "a.ts", line_start: 10, title: "Same title" }),
      makeIssue({ id: "2", file: "a.ts", line_start: 20, title: "Same title" }),
    ];
    const result = deduplicateIssues(issues);

    expect(result).toHaveLength(2);
  });

  it("should use 0 as default when line_start is null", () => {
    const issues = [
      makeIssue({ id: "1", file: "a.ts", line_start: null, title: "Same title" }),
      makeIssue({ id: "2", file: "a.ts", line_start: null, title: "Same title" }),
    ];
    const result = deduplicateIssues(issues);

    expect(result).toHaveLength(1);
  });

  it("should compare title case-insensitively", () => {
    const issues = [
      makeIssue({ id: "1", file: "a.ts", line_start: 10, title: "NULL REFERENCE" }),
      makeIssue({ id: "2", file: "a.ts", line_start: 10, title: "null reference" }),
    ];
    const result = deduplicateIssues(issues);

    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// sortIssuesBySeverity
// ---------------------------------------------------------------------------

describe("sortIssuesBySeverity", () => {
  it("should sort by severity (blocker first, nit last)", () => {
    const issues = [
      makeIssue({ severity: "nit" }),
      makeIssue({ severity: "blocker" }),
      makeIssue({ severity: "medium" }),
      makeIssue({ severity: "high" }),
      makeIssue({ severity: "low" }),
    ];
    const result = sortIssuesBySeverity(issues);

    expect(result.map((i) => i.severity)).toEqual(["blocker", "high", "medium", "low", "nit"]);
  });

  it("should sort by confidence when severity is equal", () => {
    const issues = [
      makeIssue({ severity: "high", confidence: 0.5, file: "z.ts" }),
      makeIssue({ severity: "high", confidence: 0.9, file: "a.ts" }),
    ];
    const result = sortIssuesBySeverity(issues);

    expect(result[0]!.confidence).toBe(0.9);
    expect(result[1]!.confidence).toBe(0.5);
  });

  it("should sort by file name when severity and confidence are equal", () => {
    const issues = [
      makeIssue({ severity: "high", confidence: 0.8, file: "z.ts" }),
      makeIssue({ severity: "high", confidence: 0.8, file: "a.ts" }),
    ];
    const result = sortIssuesBySeverity(issues);

    expect(result[0]!.file).toBe("a.ts");
    expect(result[1]!.file).toBe("z.ts");
  });

  it("should not mutate the original array", () => {
    const issues = [
      makeIssue({ severity: "low" }),
      makeIssue({ severity: "high" }),
    ];
    const original = [...issues];
    sortIssuesBySeverity(issues);

    expect(issues[0]!.severity).toBe(original[0]!.severity);
  });

  it("should return empty array for empty input", () => {
    expect(sortIssuesBySeverity([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// filterIssuesByMinSeverity
// ---------------------------------------------------------------------------

describe("filterIssuesByMinSeverity", () => {
  it("should return all issues when no filter is provided", () => {
    const issues = [
      makeIssue({ severity: "nit" }),
      makeIssue({ severity: "blocker" }),
    ];
    const result = filterIssuesByMinSeverity(issues);

    expect(result).toHaveLength(2);
  });

  it("should filter issues below minimum severity", () => {
    const issues = [
      makeIssue({ severity: "blocker" }),
      makeIssue({ severity: "high" }),
      makeIssue({ severity: "medium" }),
      makeIssue({ severity: "low" }),
      makeIssue({ severity: "nit" }),
    ];
    const result = filterIssuesByMinSeverity(issues, { minSeverity: "medium" });

    expect(result).toHaveLength(3);
    expect(result.map((i) => i.severity)).toEqual(["blocker", "high", "medium"]);
  });

  it("should include only blockers when minSeverity is blocker", () => {
    const issues = [
      makeIssue({ severity: "blocker" }),
      makeIssue({ severity: "high" }),
    ];
    const result = filterIssuesByMinSeverity(issues, { minSeverity: "blocker" });

    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe("blocker");
  });

  it("should include all issues when minSeverity is nit", () => {
    const issues = [
      makeIssue({ severity: "blocker" }),
      makeIssue({ severity: "nit" }),
    ];
    const result = filterIssuesByMinSeverity(issues, { minSeverity: "nit" });

    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// ensureIssueEvidence
// ---------------------------------------------------------------------------

describe("ensureIssueEvidence", () => {
  it("should return issue unchanged if it already has evidence", () => {
    const issue = makeIssue({
      evidence: [{ type: "code", title: "existing", sourceId: "s1", file: "test.ts", excerpt: "code" }],
    });
    const diff = makeDiff();

    const result = ensureIssueEvidence(issue, diff);

    expect(result).toBe(issue);
  });

  it("should create fallback evidence when file not found in diff", () => {
    const issue = makeIssue({ file: "missing.ts", evidence: [] });
    const diff = makeDiff([]);

    const result = ensureIssueEvidence(issue, diff);

    expect(result.evidence).toHaveLength(1);
    expect(result.evidence![0]!.type).toBe("code");
    expect(result.evidence![0]!.title).toContain("missing.ts");
    expect(result.evidence![0]!.excerpt).toBe(issue.rationale);
  });

  it("should extract evidence from matching hunk", () => {
    const hunk: DiffHunk = {
      oldStart: 1,
      oldCount: 5,
      newStart: 1,
      newCount: 6,
      content: "@@ -1,5 +1,6 @@\n line1\n line2\n line3\n line4\n line5\n+added",
    };
    const file = makeFileDiff({ filePath: "test.ts", hunks: [hunk] });
    const issue = makeIssue({ file: "test.ts", line_start: 3, line_end: 4, evidence: [] });
    const diff = makeDiff([file]);

    const result = ensureIssueEvidence(issue, diff);

    expect(result.evidence).toHaveLength(1);
    expect(result.evidence![0]!.type).toBe("code");
    expect(result.evidence![0]!.range).toEqual({ start: 3, end: 4 });
  });

  it("should use rationale as fallback when line_start is null", () => {
    const file = makeFileDiff({ filePath: "test.ts" });
    const issue = makeIssue({ file: "test.ts", line_start: null, evidence: [] });
    const diff = makeDiff([file]);

    const result = ensureIssueEvidence(issue, diff);

    // No hunk match since line_start is null → returns empty from extractEvidenceFromDiff
    // Falls back to rationale-based evidence
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence![0]!.excerpt).toBe(issue.rationale);
  });
});

// ---------------------------------------------------------------------------
// validateIssueCompleteness
// ---------------------------------------------------------------------------

describe("validateIssueCompleteness", () => {
  it("should return true for a complete issue", () => {
    const issue = makeIssue({
      evidence: [{ type: "code", title: "t", sourceId: "s", file: "f", excerpt: "e" }],
    });

    expect(validateIssueCompleteness(issue)).toBe(true);
  });

  it("should return false when id is empty", () => {
    const issue = makeIssue({ id: "" });
    expect(validateIssueCompleteness(issue)).toBe(false);
  });

  it("should return false when evidence is empty array", () => {
    const issue = makeIssue({ evidence: [] });
    expect(validateIssueCompleteness(issue)).toBe(false);
  });

  it("should return false when required fields are missing", () => {
    const issue = makeIssue({ title: "" });
    expect(validateIssueCompleteness(issue)).toBe(false);
  });

  it("should return false when symptom is empty", () => {
    const issue = makeIssue({ symptom: "" });
    expect(validateIssueCompleteness(issue)).toBe(false);
  });

  it("should return false when whyItMatters is empty", () => {
    const issue = makeIssue({ whyItMatters: "" });
    expect(validateIssueCompleteness(issue)).toBe(false);
  });
});
