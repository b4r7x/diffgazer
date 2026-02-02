import { describe, it, expect } from "vitest";
import {
  TriageReviewMetadataSchema,
  TriageGitContextSchema,
  SavedTriageReviewSchema,
} from "./triage-storage.js";
import { VALID_UUID, VALID_TIMESTAMP } from "../__test__/testing.js";

function createBaseMetadata(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    projectPath: "/home/user/project",
    createdAt: VALID_TIMESTAMP,
    staged: false,
    branch: "main",
    profile: "quick" as const,
    lenses: ["correctness" as const, "security" as const],
    issueCount: 5,
    blockerCount: 1,
    highCount: 2,
    mediumCount: 1,
    lowCount: 1,
    nitCount: 0,
    fileCount: 3,
    ...overrides,
  };
}

function createBaseGitContext(overrides: Record<string, unknown> = {}) {
  return {
    branch: "feature/triage-improvements",
    commit: "a1b2c3d4e5f6",
    fileCount: 3,
    additions: 150,
    deletions: 50,
    ...overrides,
  };
}

function createBaseIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: "issue-1",
    severity: "high" as const,
    category: "correctness" as const,
    title: "Null pointer issue",
    file: "src/utils/parser.ts",
    line_start: 42,
    line_end: 45,
    rationale: "Variable may be null",
    recommendation: "Add null check",
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

function createBaseDrilldown(overrides: Record<string, unknown> = {}) {
  return {
    issueId: "issue-1",
    issue: createBaseIssue(),
    detailedAnalysis: "Deep analysis of the null pointer issue",
    rootCause: "Missing validation in upstream data flow",
    impact: "Could cause runtime crash in production",
    suggestedFix: "Implement null check with early return",
    patch: "if (data === null) return null;",
    relatedIssues: ["issue-2", "issue-3"],
    references: ["https://docs.example.com/null-safety"],
    ...overrides,
  };
}

describe("TriageReviewMetadataSchema", () => {
  it("accepts valid metadata with all fields", () => {
    const result = TriageReviewMetadataSchema.safeParse(createBaseMetadata());
    expect(result.success).toBe(true);
  });

  it("accepts metadata with null branch", () => {
    const result = TriageReviewMetadataSchema.safeParse(
      createBaseMetadata({ branch: null })
    );
    expect(result.success).toBe(true);
  });

  it("accepts metadata with null profile", () => {
    const result = TriageReviewMetadataSchema.safeParse(
      createBaseMetadata({ profile: null })
    );
    expect(result.success).toBe(true);
  });

  it("accepts metadata with empty lenses array", () => {
    const result = TriageReviewMetadataSchema.safeParse(
      createBaseMetadata({ lenses: [] })
    );
    expect(result.success).toBe(true);
  });

  it.each([
    ["quick", "quick"],
    ["strict", "strict"],
    ["perf", "perf"],
    ["security", "security"],
  ])("accepts valid profile: %s", (_, profile) => {
    const result = TriageReviewMetadataSchema.safeParse(
      createBaseMetadata({ profile })
    );
    expect(result.success).toBe(true);
  });

  it.each([
    ["correctness"],
    ["security"],
    ["performance"],
    ["simplicity"],
    ["tests"],
  ])("accepts valid lens in array: %s", (lens) => {
    const result = TriageReviewMetadataSchema.safeParse(
      createBaseMetadata({ lenses: [lens] })
    );
    expect(result.success).toBe(true);
  });

  it("accepts multiple valid lenses", () => {
    const result = TriageReviewMetadataSchema.safeParse(
      createBaseMetadata({
        lenses: ["correctness", "security", "performance", "simplicity", "tests"],
      })
    );
    expect(result.success).toBe(true);
  });

  it.each([
    ["issueCount at zero", { issueCount: 0 }],
    ["blockerCount at zero", { blockerCount: 0 }],
    ["highCount at zero", { highCount: 0 }],
    ["mediumCount at zero", { mediumCount: 0 }],
    ["lowCount at zero", { lowCount: 0 }],
    ["nitCount at zero", { nitCount: 0 }],
    ["fileCount at zero", { fileCount: 0 }],
  ])("accepts %s", (_, overrides) => {
    const result = TriageReviewMetadataSchema.safeParse(
      createBaseMetadata(overrides)
    );
    expect(result.success).toBe(true);
  });

  it.each([
    ["negative issueCount", { issueCount: -1 }],
    ["negative blockerCount", { blockerCount: -1 }],
    ["negative highCount", { highCount: -1 }],
    ["negative mediumCount", { mediumCount: -1 }],
    ["negative lowCount", { lowCount: -1 }],
    ["negative nitCount", { nitCount: -1 }],
    ["negative fileCount", { fileCount: -1 }],
  ])("rejects %s", (_, overrides) => {
    const result = TriageReviewMetadataSchema.safeParse(
      createBaseMetadata(overrides)
    );
    expect(result.success).toBe(false);
  });

  it.each([
    ["non-integer issueCount", { issueCount: 5.5 }],
    ["non-integer blockerCount", { blockerCount: 1.2 }],
    ["non-integer highCount", { highCount: 2.7 }],
    ["non-integer mediumCount", { mediumCount: 1.5 }],
    ["non-integer lowCount", { lowCount: 1.3 }],
    ["non-integer nitCount", { nitCount: 0.8 }],
    ["non-integer fileCount", { fileCount: 3.3 }],
  ])("rejects %s", (_, overrides) => {
    const result = TriageReviewMetadataSchema.safeParse(
      createBaseMetadata(overrides)
    );
    expect(result.success).toBe(false);
  });

  it.each([
    ["missing id", { id: undefined }],
    ["missing projectPath", { projectPath: undefined }],
    ["missing createdAt", { createdAt: undefined }],
    ["missing staged", { staged: undefined }],
    ["missing lenses", { lenses: undefined }],
    ["missing issueCount", { issueCount: undefined }],
    ["missing fileCount", { fileCount: undefined }],
  ])("rejects metadata with %s", (_, overrides) => {
    const result = TriageReviewMetadataSchema.safeParse(
      createBaseMetadata(overrides)
    );
    expect(result.success).toBe(false);
  });

  // Severity count fields are optional for backward compatibility with old reviews
  it.each([
    ["missing blockerCount", { blockerCount: undefined }, 0],
    ["missing highCount", { highCount: undefined }, 0],
    ["missing mediumCount", { mediumCount: undefined }, 0],
    ["missing lowCount", { lowCount: undefined }, 0],
    ["missing nitCount", { nitCount: undefined }, 0],
  ])("accepts metadata with %s and defaults to 0", (_, overrides, expected) => {
    const result = TriageReviewMetadataSchema.safeParse(
      createBaseMetadata(overrides)
    );
    expect(result.success).toBe(true);
    if (result.success) {
      const fieldName = Object.keys(overrides)[0] as keyof typeof result.data;
      expect(result.data[fieldName]).toBe(expected);
    }
  });

  it("rejects metadata with invalid UUID", () => {
    const result = TriageReviewMetadataSchema.safeParse(
      createBaseMetadata({ id: "not-a-uuid" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects metadata with invalid datetime", () => {
    const result = TriageReviewMetadataSchema.safeParse(
      createBaseMetadata({ createdAt: "not-a-date" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects metadata with invalid profile", () => {
    const result = TriageReviewMetadataSchema.safeParse(
      createBaseMetadata({ profile: "invalid-profile" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects metadata with invalid lens in array", () => {
    const result = TriageReviewMetadataSchema.safeParse(
      createBaseMetadata({ lenses: ["correctness", "invalid-lens"] })
    );
    expect(result.success).toBe(false);
  });

  it("accepts metadata with all severity counts set to different values", () => {
    const result = TriageReviewMetadataSchema.safeParse(
      createBaseMetadata({
        issueCount: 10,
        blockerCount: 2,
        highCount: 3,
        mediumCount: 2,
        lowCount: 2,
        nitCount: 1,
      })
    );
    expect(result.success).toBe(true);
  });

  it("accepts metadata with all severity counts set to zero", () => {
    const result = TriageReviewMetadataSchema.safeParse(
      createBaseMetadata({
        issueCount: 0,
        blockerCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        nitCount: 0,
      })
    );
    expect(result.success).toBe(true);
  });

  it("accepts metadata with only one severity having non-zero count", () => {
    const result = TriageReviewMetadataSchema.safeParse(
      createBaseMetadata({
        issueCount: 3,
        blockerCount: 0,
        highCount: 0,
        mediumCount: 3,
        lowCount: 0,
        nitCount: 0,
      })
    );
    expect(result.success).toBe(true);
  });
});

describe("TriageGitContextSchema", () => {
  it("accepts valid git context with all fields", () => {
    const result = TriageGitContextSchema.safeParse(createBaseGitContext());
    expect(result.success).toBe(true);
  });

  it("accepts git context with null branch", () => {
    const result = TriageGitContextSchema.safeParse(
      createBaseGitContext({ branch: null })
    );
    expect(result.success).toBe(true);
  });

  it("accepts git context with null commit", () => {
    const result = TriageGitContextSchema.safeParse(
      createBaseGitContext({ commit: null })
    );
    expect(result.success).toBe(true);
  });

  it.each([
    ["fileCount at zero", { fileCount: 0 }],
    ["additions at zero", { additions: 0 }],
    ["deletions at zero", { deletions: 0 }],
  ])("accepts %s", (_, overrides) => {
    const result = TriageGitContextSchema.safeParse(
      createBaseGitContext(overrides)
    );
    expect(result.success).toBe(true);
  });

  it.each([
    ["negative fileCount", { fileCount: -1 }],
    ["negative additions", { additions: -1 }],
    ["negative deletions", { deletions: -1 }],
  ])("rejects %s", (_, overrides) => {
    const result = TriageGitContextSchema.safeParse(
      createBaseGitContext(overrides)
    );
    expect(result.success).toBe(false);
  });

  it.each([
    ["non-integer fileCount", { fileCount: 3.5 }],
    ["non-integer additions", { additions: 150.7 }],
    ["non-integer deletions", { deletions: 50.2 }],
  ])("rejects %s", (_, overrides) => {
    const result = TriageGitContextSchema.safeParse(
      createBaseGitContext(overrides)
    );
    expect(result.success).toBe(false);
  });

  it.each([
    ["missing fileCount", { fileCount: undefined }],
    ["missing additions", { additions: undefined }],
    ["missing deletions", { deletions: undefined }],
  ])("rejects git context with %s", (_, overrides) => {
    const result = TriageGitContextSchema.safeParse(
      createBaseGitContext(overrides)
    );
    expect(result.success).toBe(false);
  });
});

describe("SavedTriageReviewSchema", () => {
  it("accepts valid saved review with all fields", () => {
    const result = SavedTriageReviewSchema.safeParse({
      metadata: createBaseMetadata(),
      result: {
        summary: "Found 5 issues across 3 files",
        issues: [createBaseIssue()],
      },
      gitContext: createBaseGitContext(),
      drilldowns: [createBaseDrilldown()],
    });
    expect(result.success).toBe(true);
  });

  it("accepts saved review with empty issues", () => {
    const result = SavedTriageReviewSchema.safeParse({
      metadata: createBaseMetadata({ issueCount: 0 }),
      result: {
        summary: "No issues found",
        issues: [],
      },
      gitContext: createBaseGitContext(),
      drilldowns: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts saved review with empty drilldowns", () => {
    const result = SavedTriageReviewSchema.safeParse({
      metadata: createBaseMetadata(),
      result: {
        summary: "Found issues",
        issues: [createBaseIssue()],
      },
      gitContext: createBaseGitContext(),
      drilldowns: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts drilldown with null patch", () => {
    const result = SavedTriageReviewSchema.safeParse({
      metadata: createBaseMetadata(),
      result: {
        summary: "Found issues",
        issues: [createBaseIssue()],
      },
      gitContext: createBaseGitContext(),
      drilldowns: [createBaseDrilldown({ patch: null })],
    });
    expect(result.success).toBe(true);
  });

  it("accepts drilldown with empty arrays", () => {
    const result = SavedTriageReviewSchema.safeParse({
      metadata: createBaseMetadata(),
      result: {
        summary: "Found issues",
        issues: [createBaseIssue()],
      },
      gitContext: createBaseGitContext(),
      drilldowns: [
        createBaseDrilldown({
          relatedIssues: [],
          references: [],
        }),
      ],
    });
    expect(result.success).toBe(true);
  });

  it.each([
    ["missing metadata", { metadata: undefined }],
    ["missing result", { result: undefined }],
    ["missing gitContext", { gitContext: undefined }],
    ["missing drilldowns", { drilldowns: undefined }],
  ])("rejects saved review with %s", (_, overrides) => {
    const base = {
      metadata: createBaseMetadata(),
      result: {
        summary: "Found issues",
        issues: [createBaseIssue()],
      },
      gitContext: createBaseGitContext(),
      drilldowns: [],
    };
    const result = SavedTriageReviewSchema.safeParse({ ...base, ...overrides });
    expect(result.success).toBe(false);
  });

  it("rejects saved review with invalid metadata", () => {
    const result = SavedTriageReviewSchema.safeParse({
      metadata: { id: "not-a-uuid" },
      result: {
        summary: "Found issues",
        issues: [],
      },
      gitContext: createBaseGitContext(),
      drilldowns: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects saved review with invalid result", () => {
    const result = SavedTriageReviewSchema.safeParse({
      metadata: createBaseMetadata(),
      result: {
        summary: "Found issues",
      },
      gitContext: createBaseGitContext(),
      drilldowns: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects saved review with invalid gitContext", () => {
    const result = SavedTriageReviewSchema.safeParse({
      metadata: createBaseMetadata(),
      result: {
        summary: "Found issues",
        issues: [],
      },
      gitContext: { fileCount: -1 },
      drilldowns: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects saved review with invalid drilldown", () => {
    const result = SavedTriageReviewSchema.safeParse({
      metadata: createBaseMetadata(),
      result: {
        summary: "Found issues",
        issues: [createBaseIssue()],
      },
      gitContext: createBaseGitContext(),
      drilldowns: [{ issueId: "issue-1" }],
    });
    expect(result.success).toBe(false);
  });
});
