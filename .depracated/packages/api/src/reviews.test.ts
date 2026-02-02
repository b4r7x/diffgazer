import { describe, it, expect, vi } from "vitest";
import { getReviewStatus, type ReviewStatusResponse } from "./reviews.js";
import { getTriageReview } from "./triage.js";
import type { ApiClient, ApiError } from "./types.js";
import type { SavedTriageReview } from "@repo/schemas/triage-storage";

function createMockClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    stream: vi.fn(),
    request: vi.fn(),
    ...overrides,
  };
}

function createApiError(message: string, status: number, code?: string): ApiError {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.code = code;
  return error;
}

describe("getReviewStatus", () => {
  it("calls correct endpoint with reviewId", async () => {
    const mockGet = vi.fn().mockResolvedValue({
      sessionActive: true,
      reviewSaved: false,
      isComplete: false,
    });
    const mockClient = createMockClient({ get: mockGet });

    await getReviewStatus(mockClient, "review-123");

    expect(mockGet).toHaveBeenCalledOnce();
    expect(mockGet).toHaveBeenCalledWith("/reviews/review-123/status");
  });

  it("returns status for active session", async () => {
    const response: ReviewStatusResponse = {
      sessionActive: true,
      reviewSaved: false,
      isComplete: false,
      startedAt: "2026-01-01T12:00:00Z",
    };
    const mockGet = vi.fn().mockResolvedValue(response);
    const mockClient = createMockClient({ get: mockGet });

    const result = await getReviewStatus(mockClient, "active-review");

    expect(result).toEqual(response);
    expect(result.sessionActive).toBe(true);
    expect(result.isComplete).toBe(false);
  });

  it("returns status for completed review", async () => {
    const response: ReviewStatusResponse = {
      sessionActive: false,
      reviewSaved: true,
      isComplete: true,
      startedAt: "2026-01-01T12:00:00Z",
    };
    const mockGet = vi.fn().mockResolvedValue(response);
    const mockClient = createMockClient({ get: mockGet });

    const result = await getReviewStatus(mockClient, "completed-review");

    expect(result).toEqual(response);
    expect(result.sessionActive).toBe(false);
    expect(result.reviewSaved).toBe(true);
    expect(result.isComplete).toBe(true);
  });

  it("throws 404 error for non-existent review", async () => {
    const error = createApiError("Review not found", 404, "NOT_FOUND");
    const mockGet = vi.fn().mockRejectedValue(error);
    const mockClient = createMockClient({ get: mockGet });

    await expect(getReviewStatus(mockClient, "non-existent")).rejects.toMatchObject({
      message: "Review not found",
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("throws error for invalid UUID", async () => {
    const error = createApiError("Invalid UUID format", 400, "INVALID_UUID");
    const mockGet = vi.fn().mockRejectedValue(error);
    const mockClient = createMockClient({ get: mockGet });

    await expect(getReviewStatus(mockClient, "invalid-uuid")).rejects.toMatchObject({
      message: "Invalid UUID format",
      status: 400,
      code: "INVALID_UUID",
    });
  });

  it("throws network error when connection fails", async () => {
    const error = createApiError("Network request failed", 0);
    const mockGet = vi.fn().mockRejectedValue(error);
    const mockClient = createMockClient({ get: mockGet });

    await expect(getReviewStatus(mockClient, "review-789")).rejects.toMatchObject({
      message: "Network request failed",
      status: 0,
    });
  });

  it("makes single API call without retry", async () => {
    const error = createApiError("Server error", 500);
    const mockGet = vi.fn().mockRejectedValue(error);
    const mockClient = createMockClient({ get: mockGet });

    await expect(getReviewStatus(mockClient, "review-id")).rejects.toThrow();

    expect(mockGet).toHaveBeenCalledOnce();
  });
});

describe("getTriageReview", () => {
  const mockTriageReview: SavedTriageReview = {
    metadata: {
      id: "review-123",
      projectPath: "/test/project",
      createdAt: "2026-01-01T12:00:00Z",
      mode: "staged",
      branch: "main",
      profile: null,
      lenses: ["correctness"],
      issueCount: 5,
      blockerCount: 1,
      highCount: 2,
      mediumCount: 0,
      lowCount: 0,
      nitCount: 0,
      fileCount: 3,
    },
    result: {
      summary: "Test review",
      issues: [],
    },
    gitContext: {
      branch: "main",
      commit: "abc123",
      fileCount: 3,
      additions: 100,
      deletions: 50,
    },
    drilldowns: [],
  };

  it("calls correct endpoint with reviewId", async () => {
    const mockGet = vi.fn().mockResolvedValue({ review: mockTriageReview });
    const mockClient = createMockClient({ get: mockGet });

    await getTriageReview(mockClient, "review-123");

    expect(mockGet).toHaveBeenCalledOnce();
    expect(mockGet).toHaveBeenCalledWith("/triage/reviews/review-123");
  });

  it("returns full review data for existing review", async () => {
    const mockGet = vi.fn().mockResolvedValue({ review: mockTriageReview });
    const mockClient = createMockClient({ get: mockGet });

    const result = await getTriageReview(mockClient, "review-123");

    expect(result).toEqual({ review: mockTriageReview });
    expect(result.review.metadata.id).toBe("review-123");
    expect(result.review.metadata.issueCount).toBe(5);
    expect(result.review.gitContext.branch).toBe("main");
  });

  it("throws 404 error for non-existent review", async () => {
    const error = createApiError("Review not found", 404, "NOT_FOUND");
    const mockGet = vi.fn().mockRejectedValue(error);
    const mockClient = createMockClient({ get: mockGet });

    await expect(getTriageReview(mockClient, "non-existent")).rejects.toMatchObject({
      message: "Review not found",
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("throws 400 error for invalid UUID", async () => {
    const error = createApiError("Invalid UUID format", 400, "INVALID_UUID");
    const mockGet = vi.fn().mockRejectedValue(error);
    const mockClient = createMockClient({ get: mockGet });

    await expect(getTriageReview(mockClient, "not-a-uuid")).rejects.toMatchObject({
      message: "Invalid UUID format",
      status: 400,
      code: "INVALID_UUID",
    });
  });

  it("throws error for server errors", async () => {
    const error = createApiError("Internal server error", 500);
    const mockGet = vi.fn().mockRejectedValue(error);
    const mockClient = createMockClient({ get: mockGet });

    await expect(getTriageReview(mockClient, "review-id")).rejects.toMatchObject({
      message: "Internal server error",
      status: 500,
    });
  });

  it("makes single API call without retry on error", async () => {
    const error = createApiError("Server error", 500);
    const mockGet = vi.fn().mockRejectedValue(error);
    const mockClient = createMockClient({ get: mockGet });

    await expect(getTriageReview(mockClient, "review-id")).rejects.toThrow();

    expect(mockGet).toHaveBeenCalledOnce();
  });

  it("parses response correctly", async () => {
    const mockGet = vi.fn().mockResolvedValue({ review: mockTriageReview });
    const mockClient = createMockClient({ get: mockGet });

    const result = await getTriageReview(mockClient, "review-123");

    expect(result.review).toBeDefined();
    expect(result.review.metadata).toBeDefined();
    expect(result.review.result).toBeDefined();
    expect(result.review.gitContext).toBeDefined();
    expect(result.review.drilldowns).toBeDefined();
  });
});
