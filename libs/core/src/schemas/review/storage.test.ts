import { describe, expect, it } from "vitest";
import {
  CreateReviewResponseSchema,
  ParsedDiffSchema,
  ReviewCursorSchema,
  ReviewListWarningSchema,
  ReviewMetadataSchema,
  ReviewsResponseSchema,
  SavedReviewSchema,
} from "./storage.js";

describe("ParsedDiffSchema ownership", () => {
  it("is the schema used by stored reviews", () => {
    expect(SavedReviewSchema.shape.diff.unwrap()).toBe(ParsedDiffSchema);
  });
});

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
    { kind: "index_build_failed" },
    { kind: "index_rewrite_failed" },
  ])("accepts the $kind warning", (warning) => {
    expect(ReviewListWarningSchema.parse(warning)).toEqual(warning);
  });

  it.each([
    { kind: "unreadable_review" },
    { kind: "invalid_issues_dropped", reviewId, count: 0 },
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
      overrides: { mode: "staged" },
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

  it("applies default counts for missing severity fields", () => {
    const result = ReviewMetadataSchema.parse({
      ...baseMetadata,
    });

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
