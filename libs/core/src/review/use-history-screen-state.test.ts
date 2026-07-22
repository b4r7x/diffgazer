/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { BoundApi } from "../api/bound.js";
import { ApiProvider } from "../api/hooks/context.js";
import type { ReviewMetadata } from "../schemas/review/index.js";
import { makeReviewMetadata } from "../testing/factories.js";
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

function makeWrapper(reviews: ReviewMetadata[] = REVIEWS) {
  const api = {
    getReviews: vi.fn(async () => ({ reviews })),
    getReview: vi.fn(async () => ({ review: null })),
  } as unknown as BoundApi;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ApiProvider, { value: api }, children),
    );
  return wrapper;
}

describe("useHistoryScreenState", () => {
  it("runs the pipeline and resolves the first run as selected", async () => {
    const { result } = renderHook(() => useHistoryScreenState(), { wrapper: makeWrapper() });

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
      wrapper: makeWrapper(reviews),
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

  it("clears the selected run when the search query changes", async () => {
    const { result } = renderHook(() => useHistoryScreenState(), { wrapper: makeWrapper() });
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
    const { result } = renderHook(() => useHistoryScreenState(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.hasReviews).toBe(true));

    act(() => result.current.setSelectedRunId("run-b"));
    expect(result.current.selectedRunId).toBe("run-b");

    act(() => result.current.setSelectedDateId("2026-02-09"));
    await waitFor(() => expect(result.current.selectedRunId).toBe("run-a"));

    act(() => result.current.setSelectedDateId("all"));
    await waitFor(() => expect(result.current.selectedRunId).toBe("run-a"));
  });

  it("messages an empty run-noun empty state when no runs exist", async () => {
    const api = {
      getReviews: vi.fn(async () => ({ reviews: [] })),
      getReview: vi.fn(async () => ({ review: null })),
    } as unknown as BoundApi;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(ApiProvider, { value: api }, children),
      );

    const { result } = renderHook(() => useHistoryScreenState(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasReviews).toBe(false);
    expect(result.current.emptyRunsMessage).toBe("No runs yet");
  });

  it("loads and retains older cursor pages without duplicating runs", async () => {
    const nextCursor =
      "dg1_WyIyMDI2LTAyLTA4VDA5OjAwOjAwLjAwMFoiLCIyMjIyMjIyMi0yMjIyLTQyMjItODIyMi0yMjIyMjIyMjIyMjIiXQ";
    const getReviews = vi.fn(async (_projectPath?: string, cursor?: string) =>
      cursor
        ? { reviews: [SECOND_REVIEW, OLDER_REVIEW], nextCursor: null }
        : { reviews: REVIEWS, nextCursor },
    );
    const api = {
      getReviews,
      getReview: vi.fn(async () => ({ review: null })),
    } as unknown as BoundApi;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(ApiProvider, { value: api }, children),
      );
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
    expect(getReviews).toHaveBeenLastCalledWith(undefined, nextCursor);
  });
});
