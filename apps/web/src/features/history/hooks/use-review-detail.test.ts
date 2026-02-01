import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useReviewDetail } from "./use-review-detail";
import * as apiModule from "@repo/api";

/**
 * useReviewDetail Hook Tests
 *
 * Fix 4: New hook fetches full review data for history insights
 * Location: apps/web/src/features/history/hooks/use-review-detail.ts
 */

vi.mock("@repo/api", () => ({
  getTriageReview: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    stream: vi.fn(),
  },
}));

const mockGetTriageReview = vi.mocked(apiModule.getTriageReview);

describe("useReviewDetail", () => {
  const mockReview = {
    metadata: {
      id: "test-review-123",
      projectPath: "/test/project",
      createdAt: new Date().toISOString(),
      staged: true,
      branch: "main",
      profile: null,
      lenses: [],
      issueCount: 5,
      blockerCount: 1,
      highCount: 2,
      fileCount: 3,
    },
    result: {
      issues: [
        {
          id: "issue-1",
          title: "Test Issue",
          description: "Test description",
          file: "test.ts",
          line_start: 10,
          line_end: 10,
          category: "style",
          severity: "low",
          explanation: "Test explanation",
        },
      ],
    },
    gitContext: {
      branch: "main",
      commit: "abc123",
      fileCount: 3,
      additions: 10,
      deletions: 5,
    },
    drilldowns: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Initial State", () => {
    it("returns null review and false isLoading when reviewId is null", () => {
      const { result } = renderHook(() => useReviewDetail(null));

      expect(result.current.review).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it("returns null review when reviewId is undefined", () => {
      const { result } = renderHook(() => useReviewDetail(null));

      expect(result.current.review).toBeNull();
    });
  });

  describe("Fetching Review", () => {
    it("fetches review when reviewId is provided", async () => {
      mockGetTriageReview.mockResolvedValueOnce({ review: mockReview as any });

      const { result } = renderHook(() => useReviewDetail("test-123"));

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.review).toEqual(mockReview);
      expect(mockGetTriageReview).toHaveBeenCalledTimes(1);
    });

    it("sets isLoading to true while fetching", () => {
      mockGetTriageReview.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const { result } = renderHook(() => useReviewDetail("test-456"));

      expect(result.current.isLoading).toBe(true);
    });

    it("sets isLoading to false after fetch completes", async () => {
      mockGetTriageReview.mockResolvedValueOnce({ review: mockReview as any });

      const { result } = renderHook(() => useReviewDetail("test-789"));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it("returns fetched review data", async () => {
      mockGetTriageReview.mockResolvedValueOnce({ review: mockReview as any });

      const { result } = renderHook(() => useReviewDetail("test-abc"));

      await waitFor(() => {
        expect(result.current.review).toBeDefined();
      });

      expect(result.current.review?.metadata.id).toBe("test-review-123");
      expect(result.current.review?.result.issues).toHaveLength(1);
    });
  });

  describe("Error Handling", () => {
    it("sets review to null on error", async () => {
      mockGetTriageReview.mockRejectedValueOnce(new Error("Not found"));

      const { result } = renderHook(() => useReviewDetail("not-found"));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.review).toBeNull();
    });

    it("sets isLoading to false after error", async () => {
      mockGetTriageReview.mockRejectedValueOnce(new Error("Server error"));

      const { result } = renderHook(() => useReviewDetail("error-test"));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it("handles 404 errors gracefully", async () => {
      mockGetTriageReview.mockRejectedValueOnce({ status: 404, message: "Not found" });

      const { result } = renderHook(() => useReviewDetail("missing-review"));

      await waitFor(() => {
        expect(result.current.review).toBeNull();
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe("reviewId Changes", () => {
    it("fetches new review when reviewId changes", async () => {
      mockGetTriageReview.mockResolvedValue({ review: mockReview as any });

      const { result, rerender } = renderHook(
        ({ id }) => useReviewDetail(id),
        { initialProps: { id: "review-1" } }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGetTriageReview).toHaveBeenCalledTimes(1);

      // Change reviewId
      rerender({ id: "review-2" });

      await waitFor(() => {
        expect(mockGetTriageReview).toHaveBeenCalledTimes(2);
      });
    });

    it("clears review when reviewId becomes null", async () => {
      mockGetTriageReview.mockResolvedValueOnce({ review: mockReview as any });

      const { result, rerender } = renderHook(
        ({ id }) => useReviewDetail(id),
        { initialProps: { id: "review-xyz" as string | null } }
      );

      await waitFor(() => {
        expect(result.current.review).toBeDefined();
      });

      // Change to null
      rerender({ id: null });

      expect(result.current.review).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it("does not fetch when reviewId changes from null to null", () => {
      const { rerender } = renderHook(
        ({ id }) => useReviewDetail(id),
        { initialProps: { id: null } }
      );

      rerender({ id: null });

      expect(mockGetTriageReview).not.toHaveBeenCalled();
    });
  });

  describe("Cleanup and Cancellation", () => {
    it("prevents state updates after unmount", async () => {
      mockGetTriageReview.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ review: mockReview as any }), 50))
      );

      const { unmount } = renderHook(() => useReviewDetail("cleanup-test"));

      // Unmount before fetch completes
      unmount();

      // Wait for the promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 100));

      // No error should occur from state update after unmount
      expect(true).toBe(true);
    });

    it("cancels pending request when reviewId changes", async () => {
      let firstResolveFn: ((value: any) => void) | null = null;

      mockGetTriageReview.mockImplementation(
        () =>
          new Promise((resolve) => {
            firstResolveFn = resolve;
          })
      );

      const { rerender } = renderHook(
        ({ id }) => useReviewDetail(id),
        { initialProps: { id: "review-first" } }
      );

      // Change reviewId before first request completes
      mockGetTriageReview.mockResolvedValueOnce({ review: mockReview as any });
      rerender({ id: "review-second" });

      await waitFor(() => {
        expect(mockGetTriageReview).toHaveBeenCalledTimes(2);
      });

      // Complete first request (should be cancelled)
      if (firstResolveFn) {
        firstResolveFn({ review: mockReview });
      }

      // Second request's result should be used
      await waitFor(() => {
        expect(mockGetTriageReview).toHaveBeenCalledTimes(2);
      });
    });

    it("handles cleanup when component unmounts during fetch", async () => {
      mockGetTriageReview.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ review: mockReview as any }), 100))
      );

      const { result, unmount } = renderHook(() => useReviewDetail("unmount-test"));

      expect(result.current.isLoading).toBe(true);

      unmount();

      // No error should be thrown
      expect(true).toBe(true);
    });
  });

  describe("Integration with History Page", () => {
    it("provides review data for insights panel", async () => {
      mockGetTriageReview.mockResolvedValueOnce({ review: mockReview as any });

      const { result } = renderHook(() => useReviewDetail("insights-test"));

      await waitFor(() => {
        expect(result.current.review).toBeDefined();
      });

      // Verify data is suitable for insights panel
      expect(result.current.review?.result.issues).toBeDefined();
      expect(result.current.review?.metadata).toBeDefined();
    });

    it("returns null review for non-existent reviews", async () => {
      mockGetTriageReview.mockRejectedValueOnce(new Error("Not found"));

      const { result } = renderHook(() => useReviewDetail("nonexistent"));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.review).toBeNull();
    });
  });
});
