import { describe, it, expect } from "vitest";
import {
  TriageSeveritySchema,
  TriageCategorySchema,
  TriageIssueSchema,
  TriageResultSchema,
  TriageErrorCodeSchema,
  TriageErrorSchema,
  TriageStreamEventSchema,
  TRIAGE_SEVERITY,
  TRIAGE_CATEGORY,
  TRIAGE_SPECIFIC_CODES,
} from "./triage.js";
import { VALID_UUID } from "../__test__/testing.js";

function createBaseIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    severity: "high" as const,
    category: "correctness" as const,
    title: "Potential null pointer dereference",
    file: "src/utils/parser.ts",
    line_start: 42,
    line_end: 45,
    rationale: "The variable 'data' may be null when accessed",
    recommendation: "Add null check before accessing data properties",
    suggested_patch: "if (data !== null) { ... }",
    confidence: 0.85,
    symptom: "Accessing potentially null variable",
    whyItMatters: "Could cause runtime crash when data is undefined",
    evidence: [
      {
        type: "code",
        title: "Code at src/utils/parser.ts:42",
        sourceId: "src/utils/parser.ts:42-45",
        file: "src/utils/parser.ts",
        range: { start: 42, end: 45 },
        excerpt: "data.property",
      },
    ],
    ...overrides,
  };
}

describe("TriageSeveritySchema", () => {
  it.each([...TRIAGE_SEVERITY])(
    "accepts valid severity: %s",
    (severity) => {
      const result = TriageSeveritySchema.safeParse(severity);
      expect(result.success).toBe(true);
    }
  );

  it.each(["critical", "info", "minor", "", "BLOCKER"])(
    "rejects invalid severity: %s",
    (severity) => {
      const result = TriageSeveritySchema.safeParse(severity);
      expect(result.success).toBe(false);
    }
  );
});

describe("TriageCategorySchema", () => {
  it.each([...TRIAGE_CATEGORY])(
    "accepts valid category: %s",
    (category) => {
      const result = TriageCategorySchema.safeParse(category);
      expect(result.success).toBe(true);
    }
  );

  it.each(["bug", "feature", "documentation", "", "SECURITY"])(
    "rejects invalid category: %s",
    (category) => {
      const result = TriageCategorySchema.safeParse(category);
      expect(result.success).toBe(false);
    }
  );
});

describe("TriageIssueSchema", () => {
  it("accepts valid issue with all required fields", () => {
    const result = TriageIssueSchema.safeParse(createBaseIssue());
    expect(result.success).toBe(true);
  });

  it("accepts issue with nullable fields set to null", () => {
    const result = TriageIssueSchema.safeParse(
      createBaseIssue({
        line_start: null,
        line_end: null,
        suggested_patch: null,
      })
    );
    expect(result.success).toBe(true);
  });

  it.each([
    ["blocker", "blocker"],
    ["high", "high"],
    ["medium", "medium"],
    ["low", "low"],
    ["nit", "nit"],
  ])("accepts all severity levels: %s", (_, severity) => {
    const result = TriageIssueSchema.safeParse(createBaseIssue({ severity }));
    expect(result.success).toBe(true);
  });

  it.each([
    ["correctness", "correctness"],
    ["security", "security"],
    ["performance", "performance"],
    ["api", "api"],
    ["tests", "tests"],
    ["readability", "readability"],
    ["style", "style"],
  ])("accepts all category types: %s", (_, category) => {
    const result = TriageIssueSchema.safeParse(createBaseIssue({ category }));
    expect(result.success).toBe(true);
  });

  it.each([
    ["confidence at minimum boundary", 0],
    ["confidence at maximum boundary", 1],
    ["confidence in valid range", 0.5],
  ])("accepts %s", (_, confidence) => {
    const result = TriageIssueSchema.safeParse(createBaseIssue({ confidence }));
    expect(result.success).toBe(true);
  });

  it.each([
    ["confidence below minimum", -0.1],
    ["confidence above maximum", 1.1],
    ["confidence way above maximum", 2.0],
  ])("rejects issue with %s", (_, confidence) => {
    const result = TriageIssueSchema.safeParse(createBaseIssue({ confidence }));
    expect(result.success).toBe(false);
  });

  it.each([
    ["missing id", { id: undefined }],
    ["missing severity", { severity: undefined }],
    ["missing category", { category: undefined }],
    ["missing title", { title: undefined }],
    ["missing file", { file: undefined }],
    ["missing rationale", { rationale: undefined }],
    ["missing recommendation", { recommendation: undefined }],
    ["missing confidence", { confidence: undefined }],
  ])("rejects issue with %s", (_, overrides) => {
    const result = TriageIssueSchema.safeParse(createBaseIssue(overrides));
    expect(result.success).toBe(false);
  });

  it.each([
    ["empty id", { id: "" }],
    ["empty title", { title: "" }],
    ["empty file", { file: "" }],
    ["empty rationale", { rationale: "" }],
    ["empty recommendation", { recommendation: "" }],
  ])("accepts issue with %s", (_, overrides) => {
    const result = TriageIssueSchema.safeParse(createBaseIssue(overrides));
    expect(result.success).toBe(true);
  });
});

describe("TriageResultSchema", () => {
  it("accepts valid result with issues", () => {
    const result = TriageResultSchema.safeParse({
      summary: "Found 2 issues requiring attention",
      issues: [createBaseIssue(), createBaseIssue({ id: "issue-2" })],
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid result with empty issues array", () => {
    const result = TriageResultSchema.safeParse({
      summary: "No issues found",
      issues: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts result with empty summary string", () => {
    const result = TriageResultSchema.safeParse({
      summary: "",
      issues: [],
    });
    expect(result.success).toBe(true);
  });

  it.each([
    ["missing summary", { issues: [] }],
    ["missing issues", { summary: "Summary" }],
  ])("rejects result with %s", (_, partial) => {
    const result = TriageResultSchema.safeParse(partial);
    expect(result.success).toBe(false);
  });

  it("rejects result with invalid issue in array", () => {
    const result = TriageResultSchema.safeParse({
      summary: "Found issues",
      issues: [createBaseIssue(), { id: "invalid" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("TriageErrorCodeSchema", () => {
  it.each(TRIAGE_SPECIFIC_CODES)("accepts triage-specific code: %s", (code) => {
    const result = TriageErrorCodeSchema.safeParse(code);
    expect(result.success).toBe(true);
  });

  it.each(["INTERNAL_ERROR", "API_KEY_MISSING", "RATE_LIMITED"])(
    "accepts shared error code: %s",
    (code) => {
      const result = TriageErrorCodeSchema.safeParse(code);
      expect(result.success).toBe(true);
    }
  );

  it.each(["INVALID_CODE", "NOT_A_CODE", ""])(
    "rejects invalid code: %s",
    (code) => {
      const result = TriageErrorCodeSchema.safeParse(code);
      expect(result.success).toBe(false);
    }
  );
});

describe("TriageErrorSchema", () => {
  it("accepts valid error with triage-specific code", () => {
    const result = TriageErrorSchema.safeParse({
      message: "No diff found to analyze",
      code: "NO_DIFF",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid error with shared code", () => {
    const result = TriageErrorSchema.safeParse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
    });
    expect(result.success).toBe(true);
  });

  it.each([
    ["missing message", { code: "NO_DIFF" }],
    ["missing code", { message: "Error occurred" }],
  ])("rejects error with %s", (_, partial) => {
    const result = TriageErrorSchema.safeParse(partial);
    expect(result.success).toBe(false);
  });

  it("rejects error with invalid code", () => {
    const result = TriageErrorSchema.safeParse({
      message: "Error occurred",
      code: "INVALID_CODE",
    });
    expect(result.success).toBe(false);
  });
});

describe("TriageStreamEventSchema", () => {
  it("accepts chunk event", () => {
    const result = TriageStreamEventSchema.safeParse({
      type: "chunk",
      content: "Processing file src/utils/parser.ts...",
    });
    expect(result.success).toBe(true);
  });

  it("accepts lens_start event", () => {
    const result = TriageStreamEventSchema.safeParse({
      type: "lens_start",
      lens: "correctness",
      index: 0,
      total: 3,
    });
    expect(result.success).toBe(true);
  });

  it("accepts lens_complete event", () => {
    const result = TriageStreamEventSchema.safeParse({
      type: "lens_complete",
      lens: "security",
    });
    expect(result.success).toBe(true);
  });

  it("accepts complete event", () => {
    const result = TriageStreamEventSchema.safeParse({
      type: "complete",
      result: {
        summary: "Analysis complete",
        issues: [createBaseIssue()],
      },
      reviewId: VALID_UUID,
    });
    expect(result.success).toBe(true);
  });

  it("accepts error event", () => {
    const result = TriageStreamEventSchema.safeParse({
      type: "error",
      error: {
        message: "AI generation failed",
        code: "GENERATION_FAILED",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects event with invalid type", () => {
    const result = TriageStreamEventSchema.safeParse({
      type: "invalid",
      content: "test",
    });
    expect(result.success).toBe(false);
  });

  it.each([
    ["chunk without content", { type: "chunk" }],
    ["lens_start without lens", { type: "lens_start", index: 0, total: 3 }],
    ["lens_start without index", { type: "lens_start", lens: "correctness", total: 3 }],
    ["lens_start without total", { type: "lens_start", lens: "correctness", index: 0 }],
    ["lens_complete without lens", { type: "lens_complete" }],
    ["complete without result", { type: "complete", reviewId: VALID_UUID }],
    ["complete without reviewId", { type: "complete", result: { summary: "Done", issues: [] } }],
    ["error without error", { type: "error" }],
  ])("rejects %s", (_, event) => {
    const result = TriageStreamEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("rejects chunk event with empty content", () => {
    const result = TriageStreamEventSchema.safeParse({
      type: "chunk",
      content: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects complete event with invalid result", () => {
    const result = TriageStreamEventSchema.safeParse({
      type: "complete",
      result: { summary: "Done" },
      reviewId: VALID_UUID,
    });
    expect(result.success).toBe(false);
  });
});
