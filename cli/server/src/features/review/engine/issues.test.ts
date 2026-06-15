import { describe, expect, it } from "vitest";
import { makeFileDiff, makeIssue, makeParsedDiff } from "../../../shared/lib/testing/factories.js";
import type { DiffHunk } from "./diff/types.js";
import {
  deduplicateIssues,
  ensureIssueEvidence,
  filterIssuesByMinSeverity,
  normalizeIssueLineFields,
  sortIssuesBySeverity,
  validateIssueCompleteness,
} from "./issues.js";

describe("deduplicateIssues", () => {
  it("deduplicates by file, line, and case-insensitive title while keeping the highest severity", () => {
    const issues = [
      makeIssue({
        id: "duplicate-low",
        file: "a.ts",
        line_start: 10,
        title: "NULL REFERENCE",
        severity: "low",
      }),
      makeIssue({
        id: "duplicate-high",
        file: "a.ts",
        line_start: 10,
        title: "null reference",
        severity: "high",
      }),
      makeIssue({ id: "different-file", file: "b.ts", line_start: 10, title: "null reference" }),
      makeIssue({ id: "different-line", file: "a.ts", line_start: 20, title: "null reference" }),
      makeIssue({
        id: "null-line-one",
        file: "c.ts",
        line_start: null,
        title: "Same null line",
        severity: "medium",
      }),
      makeIssue({
        id: "null-line-two",
        file: "c.ts",
        line_start: null,
        title: "Same null line",
        severity: "nit",
      }),
    ];
    const result = deduplicateIssues(issues);
    const duplicate = result.find((issue) => issue.file === "a.ts" && issue.line_start === 10);

    expect(result).toHaveLength(4);
    expect(duplicate?.id).toBe("duplicate-high");
    expect(result.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        "duplicate-high",
        "different-file",
        "different-line",
        "null-line-one",
      ]),
    );
  });
});

describe("sortIssuesBySeverity", () => {
  it("sorts by severity, confidence, and file without mutating the input", () => {
    const issues = [
      makeIssue({ id: "low", severity: "low", file: "b.ts" }),
      makeIssue({ id: "high-z", severity: "high", confidence: 0.8, file: "z.ts" }),
      makeIssue({ id: "blocker", severity: "blocker", file: "c.ts" }),
      makeIssue({ id: "high-a", severity: "high", confidence: 0.8, file: "a.ts" }),
      makeIssue({ id: "high-confidence", severity: "high", confidence: 0.95, file: "m.ts" }),
    ];
    const originalOrder = issues.map((issue) => issue.id);

    const result = sortIssuesBySeverity(issues);

    expect(result.map((issue) => issue.id)).toEqual([
      "blocker",
      "high-confidence",
      "high-a",
      "high-z",
      "low",
    ]);
    expect(issues.map((issue) => issue.id)).toEqual(originalOrder);
  });
});

describe("filterIssuesByMinSeverity", () => {
  it("returns all issues without a filter and removes issues below the minimum severity", () => {
    const issues = [
      makeIssue({ severity: "blocker" }),
      makeIssue({ severity: "high" }),
      makeIssue({ severity: "medium" }),
      makeIssue({ severity: "low" }),
      makeIssue({ severity: "nit" }),
    ];

    const result = filterIssuesByMinSeverity(issues, { minSeverity: "medium" });

    expect(filterIssuesByMinSeverity(issues).map((i) => i.severity)).toEqual([
      "blocker",
      "high",
      "medium",
      "low",
      "nit",
    ]);
    expect(result).toHaveLength(3);
    expect(result.map((i) => i.severity)).toEqual(["blocker", "high", "medium"]);
  });
});

describe("ensureIssueEvidence", () => {
  it("returns issue unchanged when evidence already exists", () => {
    const issue = makeIssue({
      evidence: [
        { type: "code", title: "existing", sourceId: "s1", file: "test.ts", excerpt: "code" },
      ],
    });
    const diff = makeParsedDiff([]);

    const result = ensureIssueEvidence(issue, diff);

    expect(result).toBe(issue);
  });

  it("creates fallback evidence when the diff cannot provide a matching hunk", () => {
    const issue = makeIssue({ file: "missing.ts", evidence: [] });
    const nullLineIssue = makeIssue({
      id: "null-line",
      file: "test.ts",
      line_start: null,
      evidence: [],
    });
    const diff = makeParsedDiff([makeFileDiff({ filePath: "test.ts" })]);

    const result = ensureIssueEvidence(issue, diff);
    const nullLineResult = ensureIssueEvidence(nullLineIssue, diff);

    expect(result.evidence).toHaveLength(1);
    expect(result.evidence?.[0]?.type).toBe("code");
    expect(result.evidence?.[0]?.title).toContain("missing.ts");
    expect(result.evidence?.[0]?.excerpt).toBe(issue.rationale);
    expect(nullLineResult.evidence).toHaveLength(1);
    expect(nullLineResult.evidence?.[0]?.excerpt).toBe(nullLineIssue.rationale);
  });

  it("extracts evidence from a matching diff hunk", () => {
    const hunk: DiffHunk = {
      oldStart: 1,
      oldCount: 5,
      newStart: 1,
      newCount: 6,
      content: "@@ -1,5 +1,6 @@\n line1\n line2\n line3\n line4\n line5\n+added",
    };
    const file = makeFileDiff({ filePath: "test.ts", hunks: [hunk] });
    const issue = makeIssue({ file: "test.ts", line_start: 3, line_end: 4, evidence: [] });
    const diff = makeParsedDiff([file]);

    const result = ensureIssueEvidence(issue, diff);

    expect(result.evidence).toHaveLength(1);
    expect(result.evidence?.[0]?.type).toBe("code");
    expect(result.evidence?.[0]?.range).toEqual({ start: 3, end: 4 });
  });
});

describe("validateIssueCompleteness", () => {
  it("returns true for a complete issue", () => {
    const issue = makeIssue({
      evidence: [{ type: "code", title: "t", sourceId: "s", file: "f", excerpt: "e" }],
    });

    expect(validateIssueCompleteness(issue)).toBe(true);
  });

  it("returns false when required issue fields or evidence are missing", () => {
    const incompleteIssues = [
      makeIssue({ id: "" }),
      makeIssue({ title: "" }),
      makeIssue({ symptom: "" }),
      makeIssue({ whyItMatters: "" }),
      makeIssue({ evidence: [] }),
    ];

    expect(incompleteIssues.map(validateIssueCompleteness)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe("normalizeIssueLineFields", () => {
  it("nulls non-positive line numbers", () => {
    const result = normalizeIssueLineFields(makeIssue({ line_start: 0, line_end: -5 }));
    expect(result.line_start).toBeNull();
    expect(result.line_end).toBeNull();
  });

  it("floors non-integer line numbers", () => {
    const result = normalizeIssueLineFields(makeIssue({ line_start: 3.9, line_end: 7.2 }));
    expect(result.line_start).toBe(3);
    expect(result.line_end).toBe(7);
  });

  it("swaps inverted ranges", () => {
    const result = normalizeIssueLineFields(makeIssue({ line_start: 8, line_end: 4 }));
    expect(result.line_start).toBe(4);
    expect(result.line_end).toBe(8);
  });

  it("nulls line_end when line_start is null", () => {
    const result = normalizeIssueLineFields(makeIssue({ line_start: null, line_end: 9 }));
    expect(result.line_start).toBeNull();
    expect(result.line_end).toBeNull();
  });

  it("returns the same reference when nothing needs normalizing", () => {
    const issue = makeIssue({ line_start: 3, line_end: 7 });
    expect(normalizeIssueLineFields(issue)).toBe(issue);
  });
});
