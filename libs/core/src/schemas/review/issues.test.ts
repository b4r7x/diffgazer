import { describe, expect, it } from "vitest";
import {
  type EvidenceRef,
  LensReviewResultSchema,
  ReviewIssueSchema,
  type ReviewResult,
  ReviewResultSchema,
  toEvidencePresentation,
} from "./issues.js";

function createIssueInput(overrides: Record<string, unknown> = {}) {
  return {
    id: "issue-1",
    severity: "high",
    category: "correctness",
    title: "Issue title",
    file: "src/app.ts",
    line_start: 10,
    line_end: 12,
    rationale: "Because reasons",
    recommendation: "Do the thing",
    suggested_patch: null,
    confidence: 0.8,
    symptom: "A bad thing happens",
    whyItMatters: "It matters",
    evidence: [],
    ...overrides,
  };
}

describe("ReviewIssueSchema", () => {
  it("accepts valid line ranges", () => {
    expect(ReviewIssueSchema.safeParse(createIssueInput()).success).toBe(true);
    expect(
      ReviewIssueSchema.safeParse(createIssueInput({ line_start: null, line_end: null })).success,
    ).toBe(true);
  });

  // Line constraints are provider-unenforceable, so the schema is lenient: zero,
  // negative, inverted, and line_end-without-line_start values parse and are
  // corrected by normalizeIssueLineFields on the write path (F-468/F-028).
  it("accepts non-positive line numbers without failing the parse", () => {
    expect(ReviewIssueSchema.safeParse(createIssueInput({ line_start: 0 })).success).toBe(true);
    expect(ReviewIssueSchema.safeParse(createIssueInput({ line_end: -1 })).success).toBe(true);
  });

  it("accepts line_end without line_start without failing the parse", () => {
    expect(
      ReviewIssueSchema.safeParse(createIssueInput({ line_start: null, line_end: 4 })).success,
    ).toBe(true);
  });

  it("accepts descending line ranges without failing the parse", () => {
    expect(
      ReviewIssueSchema.safeParse(createIssueInput({ line_start: 8, line_end: 7 })).success,
    ).toBe(true);
  });

  it("trims semantic issue and evidence text while allowing mixed provider evidence", () => {
    const parsed = ReviewIssueSchema.parse(
      createIssueInput({
        id: " issue-1 ",
        title: " Issue title ",
        file: " src/app.ts ",
        rationale: " Because reasons ",
        recommendation: " Do the thing ",
        symptom: " A bad thing happens ",
        whyItMatters: " It matters ",
        evidence: [
          { type: "code", title: "   ", sourceId: " source:blank ", excerpt: "   " },
          { type: "code", title: " Valid ", sourceId: " source:valid ", excerpt: " code " },
        ],
      }),
    );

    expect(parsed).toMatchObject({
      id: "issue-1",
      title: "Issue title",
      file: "src/app.ts",
      rationale: "Because reasons",
      recommendation: "Do the thing",
      symptom: "A bad thing happens",
      whyItMatters: "It matters",
    });
    expect(parsed.evidence).toEqual([
      { type: "code", title: "", sourceId: "source:blank", excerpt: "" },
      { type: "code", title: "Valid", sourceId: "source:valid", excerpt: "code" },
    ]);
  });

  it.each([
    "id",
    "title",
    "file",
    "rationale",
    "recommendation",
    "symptom",
    "whyItMatters",
  ])("rejects whitespace-only %s", (field) => {
    expect(ReviewIssueSchema.safeParse(createIssueInput({ [field]: "   " })).success).toBe(false);
  });
});

describe("LensReviewResultSchema", () => {
  it("trims incomplete provider findings without rejecting the complete lens response", () => {
    const incomplete = createIssueInput({ symptom: "   " });

    const parsed = LensReviewResultSchema.parse({ issues: [incomplete] });

    expect(parsed.issues[0]?.symptom).toBe("");
    expect(ReviewIssueSchema.safeParse(parsed.issues[0]).success).toBe(false);
  });

  it("rejects the removed summary field in provider and final results", () => {
    expect(LensReviewResultSchema.safeParse({ summary: "Paid prose", issues: [] }).success).toBe(
      false,
    );
    expect(ReviewResultSchema.safeParse({ summary: "Persisted prose", issues: [] }).success).toBe(
      false,
    );

    const acceptReviewResult = (_result: ReviewResult) => undefined;
    acceptReviewResult({
      issues: [],
      // @ts-expect-error summary was removed from the public result contract.
      summary: "Persisted prose",
    });
  });
});

describe("toEvidencePresentation", () => {
  it("preserves a blank code excerpt and its backend array ordinal", () => {
    const evidence: EvidenceRef = {
      type: "code",
      title: "Parser location",
      sourceId: "source:parser",
      file: "src/parser.ts",
      range: { start: 7, end: 7 },
      excerpt: "",
    };

    expect(toEvidencePresentation(evidence, "src/fallback.ts", 3)).toEqual({
      kind: "code",
      type: "code",
      label: "Code evidence",
      title: "Parser location",
      sourceText: "source:parser",
      file: "src/parser.ts",
      startLine: 7,
      excerpt: "",
      ordinal: 3,
    });
  });
});
