import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDeleteReview } = vi.hoisted(() => ({
  mockDeleteReview: vi.fn(),
}));

// Boundary mock: api/hooks is the HTTP-data fetch boundary; we provide canned data and assert on the resulting UI.
vi.mock("@diffgazer/core/api/hooks", () => ({
  useReviews: () => ({
    data: { reviews: [] },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useReview: (id: string) => ({
    data: id ? { review: { metadata: { id } } } : undefined,
    isLoading: false,
    error: null,
  }),
  useDeleteReview: () => ({
    mutateAsync: mockDeleteReview,
    error: null,
  }),
}));

import { useReviewHistory } from "./use-review-history";

describe("useReviewHistory", () => {
  beforeEach(() => {
    mockDeleteReview.mockReset();
  });

  it("does not clear a newer selection when an older delete finishes", async () => {
    let resolveDelete: (() => void) | null = null;
    mockDeleteReview.mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveDelete = resolve;
      }),
    );

    const { result } = renderHook(() => useReviewHistory());

    act(() => result.current.loadReview("review-a"));
    expect(result.current.currentReview?.metadata.id).toBe("review-a");

    let deletePromise: Promise<void> | null = null;
    act(() => {
      deletePromise = result.current.removeReview("review-a");
    });
    act(() => result.current.loadReview("review-b"));

    await act(async () => {
      resolveDelete?.();
      await deletePromise;
    });

    expect(result.current.currentReview?.metadata.id).toBe("review-b");
  });
});
