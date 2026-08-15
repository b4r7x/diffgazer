import { describe, expect, it } from "vitest";
import { requireValue } from "../../testing/assertions.js";
import { SAVED_REVIEW_EXECUTION_SCHEMA_VERSION } from "./enums.js";
import {
  type ExecutionResult,
  hashExecutionReceiptFingerprintSync,
  TERMINAL_OUTCOMES,
} from "./execution.js";
import {
  CreateReviewResponseSchema,
  ReviewCursorSchema,
  ReviewListWarningSchema,
  ReviewMetadataSchema,
  ReviewsResponseSchema,
  resolveSavedReviewExecutionSnapshot,
  SavedReviewExecutionSnapshotSchema,
  SavedReviewSchema,
  toSavedReviewExecutionSnapshot,
} from "./storage.js";

describe("ReviewCursorSchema", () => {
  const cursor = "dg1_eyJvcGFxdWUiOiJjdXJzb3IifQ";

  it("accepts opaque pagination cursors in review responses", () => {
    expect(ReviewCursorSchema.parse(cursor)).toBe(cursor);
    expect(ReviewsResponseSchema.parse({ reviews: [], nextCursor: cursor })).toEqual({
      reviews: [],
      nextCursor: cursor,
    });
  });

  it.each([
    "550e8400-e29b-41d4-a716-446655440000",
    "dg1_not+base64url",
    `dg1_${"a".repeat(509)}`,
  ])("rejects a non-opaque or malformed cursor: %s", (value) => {
    expect(ReviewCursorSchema.safeParse(value).success).toBe(false);
  });
});

describe("ReviewListWarningSchema", () => {
  const reviewId = "550e8400-e29b-41d4-a716-446655440000";

  it.each([
    { kind: "unreadable_review", reviewId },
    { kind: "invalid_issues_dropped", reviewId, count: 2 },
    { kind: "invalid_execution_dropped", reviewId },
    { kind: "index_build_failed" },
    { kind: "index_rewrite_failed" },
  ])("accepts the $kind warning", (warning) => {
    expect(ReviewListWarningSchema.parse(warning)).toEqual(warning);
  });

  it.each([
    { kind: "unreadable_review" },
    { kind: "invalid_issues_dropped", reviewId, count: 0 },
    { kind: "invalid_execution_dropped" },
    { kind: "index_build_failed", reviewId },
    "[reviews] Failed to build project index",
  ])("rejects an invalid warning payload", (warning) => {
    expect(ReviewListWarningSchema.safeParse(warning).success).toBe(false);
  });
});

describe("ReviewMetadataSchema transform — mode backwards compat", () => {
  const baseMetadata = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    projectPath: "/home/user/project",
    createdAt: "2025-01-15T10:00:00Z",
    branch: "main",
    profile: null,
    lenses: ["correctness"],
    issueCount: 5,
    fileCount: 3,
  };

  it.each<{
    name: string;
    overrides: Record<string, unknown>;
    expectedMode: "staged" | "unstaged";
  }>([
    {
      name: "explicit mode wins",
      overrides: { mode: "staged", staged: false },
      expectedMode: "staged",
    },
    {
      name: "legacy staged=true derives mode",
      overrides: { staged: true },
      expectedMode: "staged",
    },
    {
      name: "legacy staged=false derives mode",
      overrides: { staged: false },
      expectedMode: "unstaged",
    },
    {
      name: "missing both fields defaults to unstaged",
      overrides: {},
      expectedMode: "unstaged",
    },
  ])("derives mode: $name → $expectedMode", ({ overrides, expectedMode }) => {
    const result = ReviewMetadataSchema.parse({ ...baseMetadata, ...overrides });

    expect(result.mode).toBe(expectedMode);
  });

  it("drops the legacy staged field from the canonical metadata", () => {
    const result = ReviewMetadataSchema.parse({ ...baseMetadata, mode: "staged", staged: false });

    expect(result).not.toHaveProperty("staged");
  });

  it("applies default counts for missing severity fields", () => {
    const result = ReviewMetadataSchema.parse(baseMetadata);

    expect(result.blockerCount).toBe(0);
    expect(result.highCount).toBe(0);
    expect(result.mediumCount).toBe(0);
    expect(result.lowCount).toBe(0);
    expect(result.nitCount).toBe(0);
  });

  it("accepts zero monotonic duration and rejects a negative duration", () => {
    expect(ReviewMetadataSchema.safeParse({ ...baseMetadata, durationMs: 0 }).success).toBe(true);
    expect(ReviewMetadataSchema.safeParse({ ...baseMetadata, durationMs: -1 }).success).toBe(false);
  });
});

describe("CreateReviewResponseSchema", () => {
  it("requires the active session returned by review creation", () => {
    const response = {
      reviewId: "550e8400-e29b-41d4-a716-446655440000",
      session: {
        reviewId: "550e8400-e29b-41d4-a716-446655440000",
        mode: "staged",
        startedAt: "2026-01-01T00:00:00.000Z",
        headCommit: "abc123",
        statusHash: "hash123",
      },
    };

    expect(CreateReviewResponseSchema.parse(response)).toEqual(response);
    expect(() =>
      CreateReviewResponseSchema.parse({
        reviewId: "550e8400-e29b-41d4-a716-446655440000",
      }),
    ).toThrow();
  });

  it("rejects create responses whose session does not match the review id", () => {
    expect(() =>
      CreateReviewResponseSchema.parse({
        reviewId: "550e8400-e29b-41d4-a716-446655440000",
        session: {
          reviewId: "650e8400-e29b-41d4-a716-446655440001",
          mode: "staged",
          startedAt: "2026-01-01T00:00:00.000Z",
          headCommit: "abc123",
          statusHash: "hash123",
        },
      }),
    ).toThrow();
  });

  it("validates the active session timestamp format", () => {
    expect(() =>
      CreateReviewResponseSchema.parse({
        reviewId: "550e8400-e29b-41d4-a716-446655440000",
        session: {
          reviewId: "550e8400-e29b-41d4-a716-446655440000",
          mode: "staged",
          startedAt: "not-a-date",
          headCommit: "abc123",
          statusHash: "hash123",
        },
      }),
    ).toThrow();
  });
});

const SCHEMA_SHA256 = "1".repeat(64);
const CREDENTIAL_REFERENCE_IDENTITY = "3".repeat(64);

const limits = {
  maxInputTokens: 20_000,
  maxOutputTokens: 4_000,
  maxResponseBytes: 1_048_576,
  wallTimeMs: 120_000,
  maxRetries: 2,
  maxConcurrency: 1,
  maxCostUsd: 0.5,
} as const;

function makeReceipt(outcome: (typeof TERMINAL_OUTCOMES)[number], configurationRevision = 3) {
  const receipt = {
    schemaVersion: 1 as const,
    executionFingerprint: "0".repeat(64),
    configurationId: "configuration-1",
    configurationRevision,
    credentialReferenceIdentity: CREDENTIAL_REFERENCE_IDENTITY,
    installationId: null,
    productId: "openrouter" as const,
    transportFamily: "hosted-api" as const,
    modelId: "openai/gpt-4.1-mini",
    normalizedEndpoint: "https://openrouter.ai/api/v1",
    runtime: { identity: "diffgazer-server", version: "1.2.3" },
    structuredOutputSchemaSha256: SCHEMA_SHA256,
    noticeVersion: 1,
    limits,
    attemptCount: 1,
    startedAt: "2026-07-31T10:00:00.000Z",
    finishedAt: "2026-07-31T10:00:05.000Z",
    usage: { inputTokens: 100, outputTokens: 40, totalTokens: 140 },
    usageAvailability: "reported" as const,
    outcome,
  };
  return {
    ...receipt,
    executionFingerprint: hashExecutionReceiptFingerprintSync({
      configurationId: receipt.configurationId,
      configurationRevision: receipt.configurationRevision,
      authentication: null,
      credentialReferenceIdentity: receipt.credentialReferenceIdentity,
      installationId: receipt.installationId,
      productId: receipt.productId,
      transportFamily: receipt.transportFamily,
      modelId: receipt.modelId,
      normalizedEndpoint: receipt.normalizedEndpoint,
      region: null,
      workspaceAccountReference: null,
      runtime: receipt.runtime,
      structuredOutputSchemaSha256: receipt.structuredOutputSchemaSha256,
      noticeVersion: receipt.noticeVersion,
      limits: receipt.limits,
    }),
  };
}

const baseMetadata = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  projectPath: "/home/user/project",
  createdAt: "2025-01-15T10:00:00Z",
  mode: "unstaged" as const,
  branch: "main",
  profile: null,
  lenses: ["correctness"],
  issueCount: 0,
  fileCount: 1,
};

const baseGitContext = {
  branch: "main",
  commit: "abc123",
  fileCount: 1,
  additions: 1,
  deletions: 0,
};

const sampleIssue = {
  id: "issue-1",
  severity: "high" as const,
  category: "correctness" as const,
  title: "Incorrect branch",
  file: "src/app.ts",
  line_start: 10,
  line_end: 12,
  rationale: "The branch returns the wrong value.",
  recommendation: "Return the expected value.",
  suggested_patch: null,
  confidence: 0.9,
  symptom: "The result is incorrect.",
  whyItMatters: "Callers receive invalid data.",
  evidence: [],
};

describe("SavedReview durable execution wire format", () => {
  it("round-trips completed execution receipt and usage fields", () => {
    const receipt = makeReceipt("completed");
    const saved = SavedReviewSchema.parse({
      metadata: { ...baseMetadata, issueCount: 1, highCount: 1 },
      result: { issues: [sampleIssue] },
      execution: {
        receipt,
        result: { issues: [sampleIssue] },
      },
      gitContext: baseGitContext,
    });

    const execution = requireValue(saved.execution, "saved execution");
    expect(execution.receipt.usage).toEqual({
      inputTokens: 100,
      outputTokens: 40,
      totalTokens: 140,
    });
    const snapshot = toSavedReviewExecutionSnapshot(execution);
    expect(snapshot).toEqual({
      schemaVersion: SAVED_REVIEW_EXECUTION_SCHEMA_VERSION,
      executionFingerprint: receipt.executionFingerprint,
      receipt,
    });
    expect(SavedReviewExecutionSnapshotSchema.parse(snapshot)).toEqual(snapshot);

    const { execution: _runtimeView, ...durable } = saved;

    expect(durable).toEqual({
      metadata: {
        ...baseMetadata,
        issueCount: 1,
        blockerCount: 0,
        highCount: 1,
        mediumCount: 0,
        lowCount: 0,
        nitCount: 0,
      },
      result: { issues: [sampleIssue] },
      executionSnapshot: snapshot,
      gitContext: baseGitContext,
    });
    expect(durable.result.issues).toEqual([sampleIssue]);
    expect(durable.executionSnapshot).not.toHaveProperty("result");
    expect(SavedReviewSchema.parse(durable).execution).toEqual(execution);
  });

  it("derives executionSnapshot from raw execution when the snapshot field is absent", () => {
    const receipt = makeReceipt("cancelled");
    const execution = { receipt, result: { issues: [] } } as ExecutionResult;

    expect(resolveSavedReviewExecutionSnapshot({ execution })).toEqual(
      toSavedReviewExecutionSnapshot(execution),
    );
    expect(
      resolveSavedReviewExecutionSnapshot({
        execution,
        executionSnapshot: toSavedReviewExecutionSnapshot(execution),
      }),
    ).toEqual(toSavedReviewExecutionSnapshot(execution));
  });

  it("derives the runtime execution view from a receipt-only snapshot", () => {
    const receipt = makeReceipt("completed");
    const parsed = SavedReviewSchema.parse({
      metadata: { ...baseMetadata, issueCount: 1, highCount: 1 },
      result: { issues: [sampleIssue] },
      executionSnapshot: {
        schemaVersion: SAVED_REVIEW_EXECUTION_SCHEMA_VERSION,
        executionFingerprint: receipt.executionFingerprint,
        receipt,
      },
      gitContext: baseGitContext,
    });

    expect(parsed.execution).toEqual({
      receipt,
      result: { issues: [sampleIssue] },
    });
  });

  it.each(
    TERMINAL_OUTCOMES.filter((outcome) => outcome !== "completed"),
  )("rejects %s terminal outcomes that still carry findings", (outcome) => {
    expect(
      SavedReviewSchema.safeParse({
        metadata: baseMetadata,
        result: { issues: [sampleIssue] },
        execution: {
          receipt: makeReceipt(outcome),
          result: { issues: [] },
        },
        gitContext: baseGitContext,
      }).success,
    ).toBe(false);
  });

  it("rejects completed executions whose top-level findings are empty", () => {
    const receipt = makeReceipt("completed");

    expect(
      SavedReviewSchema.safeParse({
        metadata: baseMetadata,
        result: { issues: [] },
        execution: {
          receipt,
          result: { issues: [sampleIssue] },
        },
        gitContext: baseGitContext,
      }).success,
    ).toBe(false);
  });

  it("rejects completed executions whose finding payload drifts behind the same id", () => {
    const receipt = makeReceipt("completed");
    const driftedIssue = { ...sampleIssue, severity: "medium" as const };

    expect(
      SavedReviewSchema.safeParse({
        metadata: { ...baseMetadata, issueCount: 1, mediumCount: 1 },
        result: { issues: [driftedIssue] },
        execution: {
          receipt,
          result: { issues: [sampleIssue] },
        },
        gitContext: baseGitContext,
      }).success,
    ).toBe(false);
  });

  it.each(
    TERMINAL_OUTCOMES,
  )("carries the versioned durable snapshot for the %s terminal outcome", (outcome) => {
    const receipt = makeReceipt(outcome);
    const execution = { receipt, result: { issues: [] } };
    const issues = outcome === "completed" ? [sampleIssue] : [];

    const parsed = SavedReviewSchema.parse({
      metadata: baseMetadata,
      result: { issues },
      execution: { ...execution, result: { issues } },
      executionSnapshot: {
        schemaVersion: SAVED_REVIEW_EXECUTION_SCHEMA_VERSION,
        executionFingerprint: receipt.executionFingerprint,
        receipt,
      },
      gitContext: baseGitContext,
    });

    expect(parsed.executionSnapshot?.receipt.outcome).toBe(outcome);
    expect(parsed.executionSnapshot?.executionFingerprint).toBe(receipt.executionFingerprint);
  });

  it("rejects a snapshot whose fingerprint drifts from the durable receipt", () => {
    const receipt = makeReceipt("completed");

    expect(
      SavedReviewSchema.safeParse({
        metadata: baseMetadata,
        result: { issues: [] },
        execution: { receipt, result: { issues: [] } },
        executionSnapshot: {
          schemaVersion: SAVED_REVIEW_EXECUTION_SCHEMA_VERSION,
          executionFingerprint: "f".repeat(64),
          receipt,
        },
        gitContext: baseGitContext,
      }).success,
    ).toBe(false);
  });

  it("rejects a snapshot whose fingerprint drifts from its own receipt", () => {
    expect(
      SavedReviewExecutionSnapshotSchema.safeParse({
        schemaVersion: SAVED_REVIEW_EXECUTION_SCHEMA_VERSION,
        executionFingerprint: "f".repeat(64),
        receipt: makeReceipt("completed"),
      }).success,
    ).toBe(false);
  });

  it("rejects a receipt-only review whose snapshot fingerprint drifts from its receipt", () => {
    expect(
      SavedReviewSchema.safeParse({
        metadata: baseMetadata,
        result: { issues: [] },
        executionSnapshot: {
          schemaVersion: SAVED_REVIEW_EXECUTION_SCHEMA_VERSION,
          executionFingerprint: "f".repeat(64),
          receipt: makeReceipt("completed"),
        },
        gitContext: baseGitContext,
      }).success,
    ).toBe(false);
  });

  it("rejects a snapshot whose receipt describes a different execution", () => {
    const admitted = makeReceipt("completed");
    const otherExecution = makeReceipt("transport-failed", 4);

    expect(otherExecution.executionFingerprint).not.toBe(admitted.executionFingerprint);
    expect(
      SavedReviewSchema.safeParse({
        metadata: baseMetadata,
        result: { issues: [] },
        execution: { receipt: admitted, result: { issues: [] } },
        executionSnapshot: {
          schemaVersion: SAVED_REVIEW_EXECUTION_SCHEMA_VERSION,
          executionFingerprint: admitted.executionFingerprint,
          receipt: otherExecution,
        },
        gitContext: baseGitContext,
      }).success,
    ).toBe(false);
  });

  it("preserves legacy reviews without execution metadata", () => {
    const legacy = {
      metadata: baseMetadata,
      result: { issues: [sampleIssue] },
      gitContext: baseGitContext,
    };

    const parsed = SavedReviewSchema.parse(legacy);

    expect(parsed.metadata.mode).toBe("unstaged");
    expect(parsed.result.issues).toEqual(legacy.result.issues);
    expect(parsed.execution).toBeUndefined();
  });

  it.each([
    "apiKey",
    "token",
    "password",
    "credentialValue",
    "authorization",
  ])("rejects a durable receipt carrying a %s field", (secretField) => {
    expect(
      SavedReviewSchema.safeParse({
        metadata: baseMetadata,
        result: { issues: [] },
        execution: {
          receipt: { ...makeReceipt("completed"), [secretField]: "super-secret" },
          result: { issues: [] },
        },
        gitContext: baseGitContext,
      }).success,
    ).toBe(false);
  });
});
