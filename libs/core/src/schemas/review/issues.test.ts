import { describe, expect, it } from "vitest";
import {
  LensReviewResultSchema,
  ProviderReviewIssueSchema,
  ReviewIssueSchema,
  type ReviewResult,
  ReviewResultSchema,
  ReviewSizeWarningSchema,
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
  // corrected by normalizeIssueLineFields on the write path.
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
          { type: "code", title: " Valid ", sourceId: " source:valid ", excerpt: "\ncode  \n" },
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

  it("keeps the first excerpt line's indentation on both read paths", () => {
    const excerpt = "    if (a) {\n      b();\n    }\n";
    const input = createIssueInput({
      evidence: [{ type: "code", title: "Guard", sourceId: "source:guard", excerpt }],
    });

    const parsedIssue = ReviewIssueSchema.parse(input);
    const parsedResult = ReviewResultSchema.parse({ issues: [input] });

    expect(parsedIssue.evidence[0]?.excerpt).toBe("    if (a) {\n      b();\n    }");
    expect(parsedIssue.evidence[0]?.excerpt.split("\n")).toEqual([
      "    if (a) {",
      "      b();",
      "    }",
    ]);
    expect(parsedResult.issues[0]?.evidence[0]?.excerpt).toBe(parsedIssue.evidence[0]?.excerpt);
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

describe("ProviderReviewIssueSchema", () => {
  it("validates one finding at a time on the lenient provider contract", () => {
    const salvageable = ProviderReviewIssueSchema.safeParse(createIssueInput({ symptom: "   " }));

    expect(salvageable.success).toBe(true);
    expect(salvageable.data?.symptom).toBe("");
  });

  it("still rejects a candidate that is not a finding at all", () => {
    expect(ProviderReviewIssueSchema.safeParse({ type: "code", excerpt: "x" }).success).toBe(false);
  });
});

describe("LensReviewResultSchema", () => {
  it("trims incomplete provider findings without rejecting the complete lens response", () => {
    const incomplete = createIssueInput({ symptom: "   " });

    const parsed = LensReviewResultSchema.parse({ issues: [incomplete] });

    expect(parsed.issues[0]?.symptom).toBe("");
    expect(ReviewIssueSchema.safeParse(parsed.issues[0]).success).toBe(false);
  });

  it("accepts and strips unknown top-level keys instead of voiding the lens response", () => {
    const parsed = LensReviewResultSchema.parse({
      summary: "Paid prose",
      overall: "fine",
      issues: [createIssueInput()],
    });

    expect(parsed).not.toHaveProperty("summary");
    expect(parsed).not.toHaveProperty("overall");
    expect(parsed.issues).toHaveLength(1);
  });

  it("rejects the removed summary field in the final result contract", () => {
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

describe("ReviewSizeWarningSchema", () => {
  const warning = {
    message: "Large review: 0.75MB across 40 files.",
    diffBytes: 786_432,
    estimatedInputTokens: 250_000,
    contextTokens: 1_000_000,
    modelId: "some-model",
  };

  it("reports the estimate for a model the catalog states no window for", () => {
    expect(
      ReviewSizeWarningSchema.parse({ ...warning, contextTokens: null, modelId: null }),
    ).toMatchObject({ contextTokens: null, modelId: null, estimatedInputTokens: 250_000 });
  });

  it("rejects a context window of zero, which no model has", () => {
    expect(ReviewSizeWarningSchema.safeParse({ ...warning, contextTokens: 0 }).success).toBe(false);
  });

  it("round-trips a batched review's disclosure", () => {
    const batched = { ...warning, batchCount: 3, estimatedTotalInputTokens: 750_000 };

    expect(ReviewSizeWarningSchema.parse(batched)).toEqual(batched);
  });

  it("parses a single-call advisory that states no batch numbers", () => {
    const parsed = ReviewSizeWarningSchema.parse(warning);

    expect(parsed.batchCount).toBeUndefined();
    expect(parsed.estimatedTotalInputTokens).toBeUndefined();
  });

  it("rejects a batch count of zero, which no plan has", () => {
    expect(ReviewSizeWarningSchema.safeParse({ ...warning, batchCount: 0 }).success).toBe(false);
  });
});
