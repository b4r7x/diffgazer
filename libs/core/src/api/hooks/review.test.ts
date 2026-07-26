/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryWrapper } from "../../testing/query-wrapper.js";
import type { ReviewContextResponse } from "../types.js";
import { reviewQueries } from "./queries/review.js";
import { useRefreshReviewContext, useReviews } from "./review.js";

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
    const { Wrapper } = createTestQueryWrapper({ api: { getReviews } });
    const { result } = renderHook(() => useReviews(), { wrapper: Wrapper });

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
  let harness: ReturnType<typeof createTestQueryWrapper>;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    harness = createTestQueryWrapper({
      api: { refreshReviewContext: vi.fn(async () => ({}) as ReviewContextResponse) },
    });
    invalidateSpy = vi.spyOn(harness.queryClient, "invalidateQueries");
  });

  it("invalidates the active context query key", async () => {
    const { result } = renderHook(() => useRefreshReviewContext(), {
      wrapper: harness.Wrapper,
    });
    act(() => result.current.mutate(undefined));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const keys = invalidateSpy.mock.calls.map(
      ([arg]: [unknown]) => (arg as { queryKey: unknown[] }).queryKey,
    );
    expect(keys).toContainEqual(reviewQueries.context(harness.api).queryKey);
  });
});
