/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BoundApi } from "../api/bound.js";
import type { ReviewMetadata, SavedReview } from "../schemas/review/index.js";
import { makeReviewMetadata } from "../testing/factories.js";
import { createTestQueryWrapper } from "../testing/query-wrapper.js";
import { useHistoryScreenState } from "./use-history-screen-state.js";

const FIRST_REVIEW = makeReviewMetadata({
  id: "run-a",
  projectPath: "/tmp/proj",
  createdAt: "2026-02-09T10:30:00.000Z",
  durationMs: 4500,
});
const SECOND_REVIEW = makeReviewMetadata({
  id: "run-b",
  projectPath: "/tmp/proj",
  createdAt: "2026-02-08T09:00:00.000Z",
  durationMs: 4500,
});
const REVIEWS: ReviewMetadata[] = [FIRST_REVIEW, SECOND_REVIEW];

const OLDER_REVIEW = makeReviewMetadata({
  id: "run-c",
  projectPath: "/tmp/proj",
  createdAt: "2026-02-07T09:00:00.000Z",
  durationMs: 4500,
});

const SAVED_REVIEW: SavedReview = {
  metadata: FIRST_REVIEW,
  result: { issues: [] },
  gitContext: { branch: null, commit: null, fileCount: 0, additions: 0, deletions: 0 },
};

function makeWrapper(api: Partial<BoundApi>) {
  return createTestQueryWrapper({ api }).Wrapper;
}

function makeListWrapper(reviews: ReviewMetadata[] = REVIEWS) {
  return makeWrapper({
    getReviews: vi.fn(async () => ({ reviews })),
    getReview: vi.fn(async () => ({ review: SAVED_REVIEW })),
  });
}

describe("useHistoryScreenState", () => {
  it("runs the pipeline and resolves the first run as selected", async () => {
    const { result } = renderHook(() => useHistoryScreenState(), { wrapper: makeListWrapper() });

    await waitFor(() => expect(result.current.hasReviews).toBe(true));

    expect(result.current.reviews).toHaveLength(2);
    expect(result.current.mappedRuns.map((run) => run.id)).toEqual(["run-a", "run-b"]);
    expect(result.current.selectedRunId).toBe("run-a");
    expect(result.current.selectedRun?.id).toBe("run-a");
  });

  it("keeps loaded-set run prefixes stable when a date filter hides a collider", async () => {
    const reviews = [
      makeReviewMetadata({
        id: "abcdef00-0000-4000-8000-000000000000",
        createdAt: "2026-02-09T10:30:00.000Z",
      }),
      makeReviewMetadata({
        id: "abcdef00-1000-4000-8000-000000000000",
        createdAt: "2026-02-08T09:00:00.000Z",
      }),
    ];
    const { result } = renderHook(() => useHistoryScreenState(), {
      wrapper: makeListWrapper(reviews),
    });
    await waitFor(() => expect(result.current.mappedRuns).toHaveLength(2));

    expect(result.current.mappedRuns.map((run) => run.displayId)).toEqual([
      "#abcdef00-0",
      "#abcdef00-1",
    ]);

    act(() => result.current.setSelectedDateId("2026-02-09"));
    await waitFor(() => expect(result.current.mappedRuns).toHaveLength(1));
    expect(result.current.mappedRuns[0]?.displayId).toBe("#abcdef00-0");
  });

  it("includes warning-only ids in the shared lookup used by display and exact search", async () => {
    const unreadableId = "abcdef00-0000-4000-8000-000000000000";
    const readableId = "abcdef00-1000-4000-8000-000000000000";
    const wrapper = makeWrapper({
      getReviews: vi.fn(async () => ({
        reviews: [makeReviewMetadata({ id: readableId })],
        warnings: [{ kind: "unreadable_review" as const, reviewId: unreadableId }],
      })),
      getReview: vi.fn(async () => ({ review: SAVED_REVIEW })),
    });
    const { result } = renderHook(() => useHistoryScreenState(), { wrapper });

    await waitFor(() => expect(result.current.mappedRuns[0]?.displayId).toBe("#abcdef00-1"));
    expect(result.current.runIdLookup.get(unreadableId)).toBe("#abcdef00-0");
    expect(result.current.runIdLookup.get(readableId)).toBe("#abcdef00-1");

    act(() => result.current.setSearchQuery("#abcdef00-1"));
    await waitFor(() =>
      expect(result.current.mappedRuns.map((run) => run.id)).toEqual([readableId]),
    );
  });

  it("reuses the derived run rows across re-renders that leave the loaded set and filters alone", async () => {
    const { result, rerender } = renderHook(() => useHistoryScreenState(), {
      wrapper: makeListWrapper(),
    });
    await waitFor(() => expect(result.current.hasReviews).toBe(true));

    act(() => result.current.setSearchQuery("run"));
    await waitFor(() => expect(result.current.mappedRuns).toHaveLength(2));
    const rows = result.current.mappedRuns;

    rerender();
    expect(result.current.mappedRuns).toBe(rows);

    act(() => result.current.setSelectedRunId("run-b"));
    await waitFor(() => expect(result.current.selectedRunId).toBe("run-b"));

    expect(result.current.mappedRuns).toBe(rows);
  });

  it("clears the selected run when the search query changes", async () => {
    const { result } = renderHook(() => useHistoryScreenState(), { wrapper: makeListWrapper() });
    await waitFor(() => expect(result.current.hasReviews).toBe(true));

    act(() => result.current.setSelectedRunId("run-b"));
    expect(result.current.selectedRunId).toBe("run-b");

    // Changing the filter resets the explicit selection, falling back to the first run.
    act(() => result.current.setSearchQuery("run-a"));
    await waitFor(() => expect(result.current.selectedRunId).toBe("run-a"));

    act(() => result.current.setSearchQuery(""));
    await waitFor(() => expect(result.current.selectedRunId).toBe("run-a"));
  });

  it("clears the selected run when the date filter changes", async () => {
    const { result } = renderHook(() => useHistoryScreenState(), { wrapper: makeListWrapper() });
    await waitFor(() => expect(result.current.hasReviews).toBe(true));

    act(() => result.current.setSelectedRunId("run-b"));
    expect(result.current.selectedRunId).toBe("run-b");

    act(() => result.current.setSelectedDateId("2026-02-09"));
    await waitFor(() => expect(result.current.selectedRunId).toBe("run-a"));

    act(() => result.current.setSelectedDateId("all"));
    await waitFor(() => expect(result.current.selectedRunId).toBe("run-a"));
  });

  it("messages an empty run-noun empty state when no runs exist", async () => {
    const { result } = renderHook(() => useHistoryScreenState(), {
      wrapper: makeListWrapper([]),
    });
    await waitFor(() => expect(result.current.reviewsQuery.isLoading).toBe(false));

    expect(result.current.hasReviews).toBe(false);
    expect(result.current.emptyRunsMessage).toBe("No runs yet");
  });

  it("keeps a later screen empty while loading when an earlier consumer mutates the list it received", async () => {
    const { result: first } = renderHook(() => useHistoryScreenState(), {
      wrapper: makeListWrapper([]),
    });
    const listedWhileLoading = first.current.reviews;
    expect(listedWhileLoading).toEqual([]);
    expect(() => listedWhileLoading.push(FIRST_REVIEW)).toThrow(TypeError);
    await waitFor(() => expect(first.current.reviewsQuery.isLoading).toBe(false));

    const { result: second } = renderHook(() => useHistoryScreenState(), {
      wrapper: makeListWrapper(),
    });

    expect(second.current.reviews).toEqual([]);
    expect(second.current.hasReviews).toBe(false);
    await waitFor(() => expect(second.current.hasReviews).toBe(true));
  });

  it("loads and retains older cursor pages without duplicating runs", async () => {
    const nextCursor =
      "dg1_WyIyMDI2LTAyLTA4VDA5OjAwOjAwLjAwMFoiLCIyMjIyMjIyMi0yMjIyLTQyMjItODIyMi0yMjIyMjIyMjIyMjIiXQ";
    const getReviews = vi.fn(async (cursor?: string) =>
      cursor
        ? { reviews: [SECOND_REVIEW, OLDER_REVIEW], nextCursor: null }
        : { reviews: REVIEWS, nextCursor },
    );
    const wrapper = makeWrapper({
      getReviews,
      getReview: vi.fn(async () => ({ review: SAVED_REVIEW })),
    });
    const { result } = renderHook(() => useHistoryScreenState(), { wrapper });
    await waitFor(() => expect(result.current.hasMoreReviews).toBe(true));

    await act(() => result.current.loadMoreReviews());

    await waitFor(() =>
      expect(result.current.reviews.map((review) => review.id)).toEqual([
        "run-a",
        "run-b",
        "run-c",
      ]),
    );
    expect(result.current.hasMoreReviews).toBe(false);
    expect(getReviews).toHaveBeenLastCalledWith(nextCursor, expect.any(AbortSignal));
  });

  it("keeps loaded runs visible and retries a failed older page", async () => {
    const nextCursor =
      "dg1_WyIyMDI2LTAyLTA4VDA5OjAwOjAwLjAwMFoiLCIyMjIyMjIyMi0yMjIyLTQyMjItODIyMi0yMjIyMjIyMjIyMjIiXQ";
    let olderPageAttempts = 0;
    const getReviews = vi.fn(async (cursor?: string) => {
      if (!cursor) return { reviews: REVIEWS, nextCursor };
      olderPageAttempts += 1;
      if (olderPageAttempts === 1) throw new Error("older page unavailable");
      return { reviews: [OLDER_REVIEW], nextCursor: null };
    });
    const wrapper = makeWrapper({
      getReviews,
      getReview: vi.fn(async () => ({ review: SAVED_REVIEW })),
    });
    const { result } = renderHook(() => useHistoryScreenState(), { wrapper });
    await waitFor(() => expect(result.current.hasMoreReviews).toBe(true));

    await act(() => result.current.loadMoreReviews());

    await waitFor(() =>
      expect(result.current.retainedError).toEqual({
        kind: "pagination",
        message: "older page unavailable",
      }),
    );
    expect(result.current.reviews.map((review) => review.id)).toEqual(["run-a", "run-b"]);

    await act(() => result.current.loadMoreReviews());

    await waitFor(() => expect(result.current.retainedError).toBeNull());
    expect(result.current.reviews.map((review) => review.id)).toEqual(["run-a", "run-b", "run-c"]);
    expect(getReviews).toHaveBeenLastCalledWith(nextCursor, expect.any(AbortSignal));
  });

  it("keeps loaded runs visible after a background refetch fails", async () => {
    let attempts = 0;
    const getReviews = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) return { reviews: REVIEWS };
      throw new Error("refresh unavailable");
    });
    const wrapper = makeWrapper({
      getReviews,
      getReview: vi.fn(async () => ({ review: SAVED_REVIEW })),
    });
    const { result } = renderHook(() => useHistoryScreenState(), { wrapper });
    await waitFor(() => expect(result.current.hasReviews).toBe(true));

    await act(() => result.current.reviewsQuery.refetch());

    await waitFor(() =>
      expect(result.current.retainedError).toEqual({
        kind: "refetch",
        message: "refresh unavailable",
      }),
    );
    expect(result.current.reviews.map((review) => review.id)).toEqual(["run-a", "run-b"]);
  });
});
