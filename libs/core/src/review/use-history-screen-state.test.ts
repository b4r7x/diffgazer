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

const REVIEWS: ReviewMetadata[] = [
  makeReviewMetadata({
    id: "run-a",
    projectPath: "/tmp/proj",
    createdAt: "2026-02-09T10:30:00.000Z",
    durationMs: 4500,
  }),
  makeReviewMetadata({
    id: "run-b",
    projectPath: "/tmp/proj",
    createdAt: "2026-02-08T09:00:00.000Z",
    durationMs: 4500,
  }),
];

function makeWrapper() {
  const api = {
    getReviews: vi.fn(async () => ({ reviews: REVIEWS })),
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

  it("clears the selected run when the search query changes", async () => {
    const { result } = renderHook(() => useHistoryScreenState(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.hasReviews).toBe(true));

    act(() => result.current.setSelectedRunId("run-b"));
    expect(result.current.selectedRunId).toBe("run-b");

    // Changing the filter resets the explicit selection, falling back to the first run.
    act(() => result.current.setSearchQuery("run-a"));
    await waitFor(() => expect(result.current.selectedRunId).toBe("run-a"));
  });

  it("clears the selected run when the date filter changes", async () => {
    const { result } = renderHook(() => useHistoryScreenState(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.hasReviews).toBe(true));

    act(() => result.current.setSelectedRunId("run-b"));
    expect(result.current.selectedRunId).toBe("run-b");

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
});
