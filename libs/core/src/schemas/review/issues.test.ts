import { describe, expect, it } from "vitest";
import { canonicalJson } from "../canonical-json.js";
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

  it("keeps required fields strict: evidence that is not a list of refs voids the finding", () => {
    expect(
      ProviderReviewIssueSchema.safeParse(createIssueInput({ evidence: "none" })).success,
    ).toBe(false);
    expect(
      ProviderReviewIssueSchema.safeParse(createIssueInput({ evidence: ["a bare excerpt"] }))
        .success,
    ).toBe(false);
  });

  describe("string lists (betterOptions/testsToAdd)", () => {
    // Live JSON-mode models answered testsToAdd with objects; the strict item
    // read voided the whole finding and the review ended MODEL_INCOMPATIBLE.
    const objectEntries = [
      { name: "adds two positives", description: "expect(add(2, 3)).toBe(5)" },
      { name: "adds negatives", description: "expect(add(-2, -3)).toBe(-5)" },
      { name: "adds zero", description: "expect(add(0, 5)).toBe(5)" },
      { name: "adds floats", description: "expect(add(0.1, 0.2)).toBeCloseTo(0.3)" },
    ];
    const coerced = objectEntries.map((entry) => JSON.stringify(entry));

    it("keeps the whole lens response instead of voiding it", () => {
      const parsed = LensReviewResultSchema.safeParse({
        issues: [createIssueInput({ testsToAdd: objectEntries })],
      });

      expect(parsed.success).toBe(true);
      expect(parsed.data?.issues[0]).toMatchObject({ id: "issue-1", testsToAdd: coerced });
    });

    it("keeps the finding on the per-issue salvage contract", () => {
      const parsed = ProviderReviewIssueSchema.safeParse(
        createIssueInput({ testsToAdd: objectEntries }),
      );

      expect(parsed.success).toBe(true);
      expect(parsed.data).toMatchObject({ id: "issue-1", testsToAdd: coerced });
    });

    it("coerces betterOptions entries the same way", () => {
      const parsed = ProviderReviewIssueSchema.parse(
        createIssueInput({ betterOptions: objectEntries }),
      );

      expect(parsed.betterOptions).toEqual(coerced);
    });

    it("keeps strings, stringifies scalars, and drops only content-free entries", () => {
      const parsed = ProviderReviewIssueSchema.parse(
        createIssueInput({ testsToAdd: ["keep", { name: "adds zero" }, 7, null] }),
      );

      expect(parsed.testsToAdd).toEqual(["keep", '{"name":"adds zero"}', "7"]);
    });

    it("reads a lone value as a one-item list", () => {
      expect(
        ProviderReviewIssueSchema.parse(createIssueInput({ testsToAdd: "add a test" })).testsToAdd,
      ).toEqual(["add a test"]);
      expect(
        ProviderReviewIssueSchema.parse(createIssueInput({ betterOptions: { name: "adds zero" } }))
          .betterOptions,
      ).toEqual(['{"name":"adds zero"}']);
    });

    it("leaves an omitted list absent instead of materializing an undefined key", () => {
      const parsed = ProviderReviewIssueSchema.parse(createIssueInput());

      expect(parsed).not.toHaveProperty("testsToAdd");
      expect(parsed).not.toHaveProperty("betterOptions");
    });

    it("still rejects object entries on the persisted contract", () => {
      expect(
        ReviewIssueSchema.safeParse(createIssueInput({ testsToAdd: objectEntries })).success,
      ).toBe(false);
      expect(
        ReviewIssueSchema.safeParse(createIssueInput({ betterOptions: objectEntries })).success,
      ).toBe(false);
    });
  });

  describe("null optionals", () => {
    // The strict wire schema declares every optional key nullable AND required
    // (structured-output-schema.ts), so a conforming route answers null for a
    // key it has nothing for.
    it.each([
      "fixPlan",
      "betterOptions",
      "testsToAdd",
      "trace",
    ])("reads %s: null as an omitted key", (key) => {
      const parsed = ProviderReviewIssueSchema.safeParse(createIssueInput({ [key]: null }));

      expect(parsed.success).toBe(true);
      expect(parsed.data).not.toHaveProperty(key);
    });
  });

  describe("absent nullables", () => {
    // The prompt says "null if not applicable" for these keys, and a JSON-mode
    // route with nothing for one can omit it instead. Absent reads as null.
    it.each(["suggested_patch", "line_start", "line_end"])("reads an omitted %s as null", (key) => {
      const input = Object.fromEntries(
        Object.entries(createIssueInput()).filter(([name]) => name !== key),
      );
      const parsed = ProviderReviewIssueSchema.parse(input);

      expect(parsed).toStrictEqual(createIssueInput({ [key]: null }));
      expect(ReviewIssueSchema.safeParse(parsed).success).toBe(true);
      expect(() => canonicalJson(parsed)).not.toThrow();
    });
  });

  describe("fixPlan steps", () => {
    it.each([
      {
        shape: "prose steps",
        fixPlan: ["do this", "then that"],
        expected: [
          { step: 1, action: "do this" },
          { step: 2, action: "then that" },
        ],
      },
      { shape: "a lone step", fixPlan: "do this", expected: [{ step: 1, action: "do this" }] },
      {
        shape: "a step number given as text",
        fixPlan: [{ step: "1", action: "a" }],
        expected: [{ step: 1, action: "a" }],
      },
      {
        shape: "a risk outside the enum",
        fixPlan: [{ step: 1, action: "a", risk: "critical" }],
        expected: [{ step: 1, action: "a" }],
      },
      {
        shape: "a capitalised risk",
        fixPlan: [{ step: 1, action: "a", risk: "Low" }],
        expected: [{ step: 1, action: "a", risk: "low" }],
      },
      {
        shape: "file entries that are not ids",
        fixPlan: [{ step: 1, action: "a", files: ["file-1", { path: "src/add.ts" }, null] }],
        expected: [{ step: 1, action: "a", files: ["file-1"] }],
      },
      {
        shape: "a blank file entry",
        fixPlan: [{ step: 1, action: "a", files: ["file-1", "  "] }],
        expected: [{ step: 1, action: "a", files: ["file-1"] }],
      },
      {
        shape: "a lone file id",
        fixPlan: [{ step: 1, action: "a", files: "file-1" }],
        expected: [{ step: 1, action: "a", files: ["file-1"] }],
      },
      {
        shape: "null files and risk",
        fixPlan: [{ step: 1, action: "a", files: null, risk: null }],
        expected: [{ step: 1, action: "a" }],
      },
      {
        shape: "a step without an action",
        fixPlan: [{ step: 1 }, { step: 2, action: { text: "b" } }, { step: 3, action: "c" }],
        expected: [{ step: 3, action: "c" }],
      },
    ])("reads $shape", ({ fixPlan, expected }) => {
      expect(ProviderReviewIssueSchema.parse(createIssueInput({ fixPlan })).fixPlan).toStrictEqual(
        expected,
      );
    });

    it("numbers a step without a number by its position among the kept steps", () => {
      const parsed = ProviderReviewIssueSchema.parse(
        createIssueInput({ fixPlan: [null, "do this", { step: "two", action: "then that" }] }),
      );

      expect(parsed.fixPlan).toStrictEqual([
        { step: 1, action: "do this" },
        { step: 2, action: "then that" },
      ]);
    });

    it("keeps a well-formed plan as sent", () => {
      const fixPlan = [{ step: 2, action: "a", files: ["file-1"], risk: "high" }];

      expect(ProviderReviewIssueSchema.parse(createIssueInput({ fixPlan })).fixPlan).toStrictEqual(
        fixPlan,
      );
    });
  });

  describe("evidence refs", () => {
    const ref = { type: "code", title: "Guard", sourceId: "source:guard", excerpt: "if (a) {" };

    it.each([
      { shape: "a range given as text", overrides: { range: "1-2" } },
      { shape: "a range with text bounds", overrides: { range: { start: "1", end: "2" } } },
      { shape: "a range without an end", overrides: { range: { start: 1 } } },
      { shape: "a null range", overrides: { range: null } },
      { shape: "a file that is not an id", overrides: { file: 3 } },
      { shape: "a blank file", overrides: { file: "  " } },
      { shape: "a null sha", overrides: { sha: null } },
    ])("keeps the excerpt and drops $shape", ({ overrides }) => {
      const parsed = ProviderReviewIssueSchema.parse(
        createIssueInput({ evidence: [{ ...ref, ...overrides }] }),
      );

      expect(parsed.evidence).toStrictEqual([ref]);
    });

    // The server keeps a non-code ref only when title, sourceId and excerpt all
    // carry visible text and re-derives code evidence from the diff, so a ref
    // missing one of them is the server's to drop, never a reason to void the
    // finding.
    it.each([
      {
        shape: "an external ref without an excerpt",
        input: { type: "external", title: "RFC 7231", sourceId: "rfc:7231" },
        blank: "excerpt",
      },
      {
        shape: "a doc ref with a null excerpt",
        input: { type: "doc", title: "Spec", sourceId: "doc:spec", excerpt: null },
        blank: "excerpt",
      },
      {
        shape: "a code ref with a null excerpt",
        input: { ...ref, excerpt: null },
        blank: "excerpt",
      },
      {
        shape: "a doc ref with a null title",
        input: { type: "doc", title: null, sourceId: "doc:spec", excerpt: "quoted" },
        blank: "title",
      },
      {
        shape: "a doc ref with a null sourceId",
        input: { type: "doc", title: "Spec", sourceId: null, excerpt: "quoted" },
        blank: "sourceId",
      },
      {
        shape: "a doc ref whose excerpt is a number",
        input: { type: "doc", title: "Spec", sourceId: "doc:spec", excerpt: 42 },
        blank: "excerpt",
      },
    ])("keeps the finding and reads $shape as blank for the server to drop", ({ input, blank }) => {
      const parsed = ProviderReviewIssueSchema.parse(createIssueInput({ evidence: [input] }));

      expect(parsed.evidence).toStrictEqual([{ ...input, [blank]: "" }]);
      expect(ReviewIssueSchema.safeParse(parsed).success).toBe(true);
      expect(() => canonicalJson(parsed)).not.toThrow();
    });

    it.each([
      "snippet",
      "Code",
    ])("keeps a ref's type strict: %s still voids the finding", (type) => {
      expect(
        ProviderReviewIssueSchema.safeParse(createIssueInput({ evidence: [{ ...ref, type }] }))
          .success,
      ).toBe(false);
    });

    it("keeps a well-formed ref as sent", () => {
      const evidence = [{ ...ref, file: "file-1", range: { start: 1, end: 3 }, sha: "abc" }];

      expect(
        ProviderReviewIssueSchema.parse(createIssueInput({ evidence })).evidence,
      ).toStrictEqual(evidence);
    });
  });

  describe("trace", () => {
    it("keeps well-formed entries and drops the rest", () => {
      const entry = {
        step: 1,
        tool: "grep",
        inputSummary: "in",
        outputSummary: "out",
        timestamp: "t",
      };
      const parsed = ProviderReviewIssueSchema.parse(
        createIssueInput({ trace: [entry, "step one", { step: 2 }, null] }),
      );

      expect(parsed.trace).toStrictEqual([entry]);
    });
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

  it("reads a strict route's null optionals as omitted, still satisfying the persisted contract", () => {
    const ref = { type: "code", title: "Guard", sourceId: "source:guard", excerpt: "if (a) {" };
    const parsed = LensReviewResultSchema.parse({
      issues: [
        createIssueInput({
          fixPlan: [{ step: 1, action: "a", files: null, risk: null }],
          betterOptions: null,
          testsToAdd: null,
          trace: null,
          evidence: [{ ...ref, file: null, range: null, sha: null }],
        }),
      ],
    });

    expect(parsed.issues[0]).toStrictEqual(
      createIssueInput({ fixPlan: [{ step: 1, action: "a" }], evidence: [ref] }),
    );
    expect(ReviewResultSchema.safeParse(parsed).success).toBe(true);
    expect(() => canonicalJson(parsed.issues)).not.toThrow();
  });

  it("reads a JSON-mode route's omitted nullable keys as null, still satisfying the persisted contract", () => {
    const {
      line_start: _start,
      line_end: _end,
      suggested_patch: _patch,
      ...input
    } = createIssueInput();
    const parsed = LensReviewResultSchema.parse({ issues: [input] });

    expect(parsed.issues[0]).toStrictEqual(createIssueInput({ line_start: null, line_end: null }));
    expect(ReviewResultSchema.safeParse(parsed).success).toBe(true);
    expect(() => canonicalJson(parsed.issues)).not.toThrow();
  });

  it("keeps the whole lens response when its only finding cites an external ref without an excerpt", () => {
    const external = { type: "external", title: "RFC 7231", sourceId: "rfc:7231" };
    const parsed = LensReviewResultSchema.safeParse({
      issues: [createIssueInput({ evidence: [external] })],
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.issues[0]?.evidence).toStrictEqual([{ ...external, excerpt: "" }]);
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
