import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  api: {
    getReviews: vi.fn(),
    deleteReview: vi.fn(),
  },
}));

import { useReviews } from "./use-reviews";
import { api } from "@/lib/api";

const mockGetReviews = api.getReviews as ReturnType<typeof vi.fn>;
const mockDeleteReview = api.deleteReview as ReturnType<typeof vi.fn>;

const testReviews = [
  { id: "r-1", projectPath: "/proj", createdAt: "2026-01-01", mode: "staged" },
  { id: "r-2", projectPath: "/proj", createdAt: "2026-01-02", mode: "unstaged" },
];

describe("useReviews", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetReviews.mockResolvedValue({ reviews: testReviews });
    mockDeleteReview.mockResolvedValue({ success: true });
  });

  it("should remove item after successful API delete", async () => {
    const { result } = renderHook(() => useReviews());

    // Wait for initial fetch
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.reviews).toHaveLength(2);

    // Delete r-1
    await act(async () => {
      await result.current.deleteReview("r-1");
    });

    expect(result.current.reviews).toHaveLength(1);
    expect(result.current.reviews[0]?.id).toBe("r-2");
  });

  it("should refetch reviews on delete failure", async () => {
    mockDeleteReview.mockRejectedValue(new Error("Network error"));
    // After failed delete, fetchReviews is called to restore state
    mockGetReviews
      .mockResolvedValueOnce({ reviews: testReviews }) // initial fetch
      .mockResolvedValueOnce({ reviews: testReviews }); // rollback refetch

    const { result } = renderHook(() => useReviews());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.deleteReview("r-1");
    });

    // After rollback refetch, both items should be restored
    await waitFor(() => {
      expect(result.current.reviews).toHaveLength(2);
    });
  });

  it("should persist successful delete", async () => {
    const { result } = renderHook(() => useReviews());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.deleteReview("r-2");
    });

    expect(mockDeleteReview).toHaveBeenCalledWith("r-2");
    expect(result.current.reviews).toHaveLength(1);
    expect(result.current.reviews[0]?.id).toBe("r-1");
    expect(result.current.error).toBeNull();
  });
});
