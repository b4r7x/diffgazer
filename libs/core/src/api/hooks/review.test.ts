/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BoundApi } from "../bound.js";
import { ApiProvider } from "./context.js";
import { reviewQueries } from "./queries/review.js";
import { useRefreshReviewContext, useReviews } from "./review.js";

function makeWrapper(api: BoundApi, queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ApiProvider, { value: api }, children),
    );
}

describe("useReviews", () => {
  it("deduplicates typed warnings across cursor pages without collapsing distinct records", async () => {
    const unreadable = {
      kind: "unreadable_review" as const,
      reviewId: "11111111-1111-4111-8111-111111111111",
    };
    const getReviews = vi.fn(async (_projectPath?: string, cursor?: string) =>
      cursor
        ? {
            reviews: [],
            warnings: [
              unreadable,
              { kind: "index_build_failed" as const },
              {
                kind: "invalid_issues_dropped" as const,
                reviewId: unreadable.reviewId,
                count: 2,
              },
            ],
          }
        : {
            reviews: [],
            nextCursor: "dg1_b2xkZXItcmV2aWV3cw",
            warnings: [
              unreadable,
              { kind: "index_build_failed" as const },
              {
                kind: "invalid_issues_dropped" as const,
                reviewId: unreadable.reviewId,
                count: 1,
              },
            ],
          },
    );
    const api = { getReviews } as unknown as BoundApi;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useReviews(), {
      wrapper: makeWrapper(api, queryClient),
    });

    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(() => result.current.fetchNextPage());

    await waitFor(() =>
      expect(result.current.data?.warnings).toEqual([
        unreadable,
        { kind: "index_build_failed" },
        { kind: "invalid_issues_dropped", reviewId: unreadable.reviewId, count: 2 },
      ]),
    );
  });
});

describe("useRefreshReviewContext", () => {
  let api: BoundApi;
  let queryClient: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    api = {
      refreshReviewContext: vi.fn(async () => ({ context: undefined })),
    } as unknown as BoundApi;
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  });

  it("invalidates the active context query key", async () => {
    const { result } = renderHook(() => useRefreshReviewContext(), {
      wrapper: makeWrapper(api, queryClient),
    });
    act(() => result.current.mutate(undefined));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const keys = invalidateSpy.mock.calls.map(
      ([arg]: [unknown]) => (arg as { queryKey: unknown[] }).queryKey,
    );
    expect(keys).toContainEqual(reviewQueries.context(api).queryKey);
  });
});
