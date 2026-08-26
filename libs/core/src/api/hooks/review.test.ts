/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActiveReviewSession } from "../../schemas/review/index.js";
import { makeReviewMetadata } from "../../testing/factories.js";
import { createTestQueryWrapper } from "../../testing/query-wrapper.js";
import type { BoundApi } from "../bound.js";
import type { ReviewContextResponse } from "../types.js";
import { reviewQueries } from "./queries/review.js";
import { useActiveReviewSession, useRefreshReviewContext, useReviews } from "./review.js";

describe("useReviews", () => {
  it("deduplicates typed warnings across cursor pages without collapsing distinct records", async () => {
    const sharedReview = makeReviewMetadata({
      id: "11111111-1111-4111-8111-111111111111",
    });
    const distinctReview = makeReviewMetadata({
      id: "22222222-2222-4222-8222-222222222222",
    });
    const unreadableShared = {
      kind: "unreadable_review" as const,
      reviewId: sharedReview.id,
    };
    const unreadableDistinct = {
      kind: "unreadable_review" as const,
      reviewId: distinctReview.id,
    };
    const getReviews = vi.fn<BoundApi["getReviews"]>().mockImplementation(async (cursor) =>
      cursor
        ? {
            reviews: [distinctReview],
            warnings: [
              unreadableDistinct,
              {
                kind: "invalid_issues_dropped" as const,
                reviewId: sharedReview.id,
                count: 2,
              },
            ],
          }
        : {
            reviews: [sharedReview],
            nextCursor: "dg1_b2xkZXItcmV2aWV3cw",
            warnings: [
              unreadableShared,
              { kind: "index_build_failed" as const },
              {
                kind: "invalid_issues_dropped" as const,
                reviewId: sharedReview.id,
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
      expect(result.current.data?.reviews.map((review) => review.id)).toEqual([
        sharedReview.id,
        distinctReview.id,
      ]),
    );
    expect(result.current.data?.warnings).toEqual([
      unreadableShared,
      { kind: "index_build_failed" },
      { kind: "invalid_issues_dropped", reviewId: sharedReview.id, count: 2 },
      unreadableDistinct,
    ]);
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

describe("useActiveReviewSession", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the cached session past the default gc window after the last observer unmounts", async () => {
    // shouldAdvanceTime lets react-query's internal scheduling still progress
    // while the test drives the gc timer past the 5-minute default.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const session: ActiveReviewSession = {
      reviewId: "11111111-1111-4111-8111-111111111111",
      mode: "staged",
      startedAt: "2026-01-01T00:00:00.000Z",
      headCommit: "abc123",
      statusHash: "hash123",
    };
    const getActiveReviewSession = vi
      .fn<BoundApi["getActiveReviewSession"]>()
      .mockResolvedValue({ session });
    const { Wrapper, queryClient, api } = createTestQueryWrapper({
      api: { getActiveReviewSession },
    });

    const { result, unmount } = renderHook(() => useActiveReviewSession("staged"), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.data).toEqual({ session }));

    unmount();
    act(() => {
      vi.advanceTimersByTime(6 * 60 * 1000);
    });

    expect(queryClient.getQueryData(reviewQueries.activeSession(api, "staged").queryKey)).toEqual({
      session,
    });
  });
});
