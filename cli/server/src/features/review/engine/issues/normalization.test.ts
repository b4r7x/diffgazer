import { describe, expect, it } from "vitest";
import { makeIssue } from "../../../../shared/lib/testing/factories.js";
import { normalizeIssueLineFields, validateIssueCompleteness } from "./normalization.js";

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
