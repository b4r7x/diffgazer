import { describe, expect, it } from "vitest";
import { makeFileDiff, makeIssue, makeParsedDiff } from "../../../shared/lib/testing/factories.js";
import type { DiffHunk } from "./diff/types.js";
import {
  createIssueEvidenceResolver,
  deduplicateIssues,
  ensureIssueEvidence,
  filterIssuesByMinSeverity,
  MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES,
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

  it("keeps titles that differ after a shared 50-character prefix", () => {
    const prefix = "same normalized title prefix ".padEnd(60, "x");
    const issues = [
      makeIssue({ id: "first-suffix", title: `${prefix} first` }),
      makeIssue({ id: "second-suffix", title: `${prefix} second` }),
    ];

    expect(deduplicateIssues(issues).map((issue) => issue.id)).toEqual([
      "first-suffix",
      "second-suffix",
    ]);
  });

  it("keeps delimiter-bearing file and title identities distinct", () => {
    const issues = [
      makeIssue({ id: "delimiter-in-file", file: "src:10", line_start: 20, line_end: 20 }),
      makeIssue({
        id: "delimiter-in-title",
        file: "src",
        line_start: 10,
        line_end: 20,
        title: "20:Test issue",
      }),
    ];

    expect(deduplicateIssues(issues).map((issue) => issue.id)).toEqual([
      "delimiter-in-file",
      "delimiter-in-title",
    ]);
  });

  it("treats the end line and category as identity fields", () => {
    const issues = [
      makeIssue({ id: "base", line_end: 15, category: "correctness" }),
      makeIssue({ id: "different-end", line_end: 16, category: "correctness" }),
      makeIssue({ id: "different-category", line_end: 15, category: "security" }),
    ];

    expect(deduplicateIssues(issues).map((issue) => issue.id)).toEqual([
      "base",
      "different-end",
      "different-category",
    ]);
  });

  it("retains a complete lower-severity duplicate when incomplete output is removed first", () => {
    const evidence = [{ type: "code" as const, title: "e", sourceId: "s", excerpt: "x" }];
    const complete = makeIssue({
      id: "complete",
      severity: "medium",
      title: "Shared bug",
      evidence,
    });
    const incomplete = makeIssue({
      id: "incomplete",
      severity: "high",
      title: "Shared bug",
      evidence,
    });
    incomplete.symptom = "";

    const result = deduplicateIssues([complete, incomplete].filter(validateIssueCompleteness));

    expect(result.map((issue) => issue.id)).toEqual(["complete"]);
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

  it("produces one transitive order for every permutation of close confidence values", () => {
    const issues = [
      makeIssue({ id: "confidence-800", severity: "high", confidence: 0.8, file: "z.ts" }),
      makeIssue({ id: "confidence-806", severity: "high", confidence: 0.806, file: "a.ts" }),
      makeIssue({ id: "confidence-812", severity: "high", confidence: 0.812, file: "m.ts" }),
    ];
    const permutations = [
      [issues[0], issues[1], issues[2]],
      [issues[0], issues[2], issues[1]],
      [issues[1], issues[0], issues[2]],
      [issues[1], issues[2], issues[0]],
      [issues[2], issues[0], issues[1]],
      [issues[2], issues[1], issues[0]],
    ];

    const outputs = new Set(
      permutations.map((permutation) =>
        sortIssuesBySeverity(permutation.filter((issue) => issue !== undefined))
          .map((issue) => issue.id)
          .join(","),
      ),
    );

    expect(outputs).toEqual(new Set(["confidence-812,confidence-806,confidence-800"]));
  });

  it("keeps pair order antisymmetric and triple order transitive", () => {
    const low = makeIssue({ id: "low", severity: "medium", confidence: 0.8, file: "z.ts" });
    const middle = makeIssue({
      id: "middle",
      severity: "medium",
      confidence: 0.806,
      file: "a.ts",
    });
    const high = makeIssue({
      id: "high",
      severity: "medium",
      confidence: 0.812,
      file: "m.ts",
    });

    expect(sortIssuesBySeverity([low, middle]).map((issue) => issue.id)).toEqual(["middle", "low"]);
    expect(sortIssuesBySeverity([middle, low]).map((issue) => issue.id)).toEqual(["middle", "low"]);
    expect(sortIssuesBySeverity([middle, high]).map((issue) => issue.id)).toEqual([
      "high",
      "middle",
    ]);
    expect(sortIssuesBySeverity([low, high]).map((issue) => issue.id)).toEqual(["high", "low"]);
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

  it("keeps only complete references from mixed provider evidence", () => {
    const issue = makeIssue({
      evidence: [
        { type: "code", title: "   ", sourceId: "blank", excerpt: "   " },
        { type: "code", title: "Valid", sourceId: "source", excerpt: "code" },
      ],
    });

    const result = ensureIssueEvidence(issue, makeParsedDiff([]));

    expect(result.evidence).toEqual([
      { type: "code", title: "Valid", sourceId: "source", excerpt: "code" },
    ]);
  });

  it("replaces all-whitespace provider evidence with synthesized evidence", () => {
    const issue = makeIssue({
      evidence: [{ type: "code", title: "   ", sourceId: "   ", excerpt: "   " }],
    });

    const result = ensureIssueEvidence(issue, makeParsedDiff([]));

    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]).toMatchObject({
      type: "code",
      title: `Issue in ${issue.file}`,
      sourceId: issue.file,
      excerpt: issue.rationale,
    });
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

  it("normalizes an inverted fractional range before sampling both hunks", () => {
    const firstLine = "a".repeat(5_000);
    const secondLine = "b".repeat(5_000);
    const firstHunk: DiffHunk = {
      oldStart: 10,
      oldCount: 8,
      newStart: 10,
      newCount: 8,
      content: `@@ -10,8 +10,8 @@\n ${firstLine}\n line11\n line12\n line13\n line14\n line15\n line16\n line17`,
    };
    const secondHunk: DiffHunk = {
      oldStart: 30,
      oldCount: 4,
      newStart: 30,
      newCount: 4,
      content: `@@ -30,4 +30,4 @@\n ${secondLine}\n line31\n line32\n line33`,
    };
    const diff = makeParsedDiff([
      makeFileDiff({ filePath: "test.ts", hunks: [firstHunk, secondHunk] }),
    ]);
    const resolveEvidence = createIssueEvidenceResolver(diff);

    const result = resolveEvidence(
      makeIssue({ file: "test.ts", line_start: 33.8, line_end: 10.9, evidence: [] }),
    );

    const evidence = result.evidence?.[0];
    const excerpt = evidence?.excerpt ?? "";
    const excerptLines = excerpt.split("\n");
    expect(result).toMatchObject({ line_start: 10, line_end: 33 });
    expect(excerptLines).toHaveLength(5);
    expect(excerptLines[0]).toMatch(/^a+$/);
    expect(excerptLines.some((line) => line.startsWith("b"))).toBe(true);
    expect(excerptLines.filter((line) => line === "... [evidence gap] ...")).toHaveLength(1);
    expect(Buffer.byteLength(JSON.stringify(excerpt), "utf8")).toBeLessThanOrEqual(
      MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES,
    );
    expect(evidence?.range).toEqual({ start: 10, end: 33 });
    expect(evidence?.sourceId).toBe("test.ts:10-33");
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

  it("rejects whitespace-only fields and accepts evidence when at least one reference is visible", () => {
    const whitespaceIssue = makeIssue({ symptom: "   " });
    const mixedEvidenceIssue = makeIssue({
      evidence: [
        { type: "code", title: "", sourceId: "", excerpt: "" },
        { type: "code", title: "Visible", sourceId: "source", excerpt: "excerpt" },
      ],
    });

    expect(validateIssueCompleteness(whitespaceIssue)).toBe(false);
    expect(validateIssueCompleteness(mixedEvidenceIssue)).toBe(true);
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

  it("omits malformed evidence ranges while retaining their excerpts", () => {
    const ranges = [
      { start: -1, end: 2 },
      { start: 1.5, end: 2 },
      { start: 0, end: 1 },
      { start: 8, end: 4 },
    ];
    const issue = makeIssue({
      evidence: ranges.map((range, index) => ({
        type: "code",
        title: `Evidence ${index}`,
        sourceId: `source-${index}`,
        range,
        excerpt: `excerpt-${index}`,
      })),
    });

    const result = normalizeIssueLineFields(issue);

    expect(result.evidence).toEqual(
      ranges.map((_range, index) => ({
        type: "code",
        title: `Evidence ${index}`,
        sourceId: `source-${index}`,
        excerpt: `excerpt-${index}`,
      })),
    );
  });

  it("returns the same reference when nothing needs normalizing", () => {
    const issue = makeIssue({ line_start: 3, line_end: 7 });
    expect(normalizeIssueLineFields(issue)).toBe(issue);
  });
});
