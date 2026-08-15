import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createDeferred } from "../../../testing/deferred.js";
import { makeReviewMetadata } from "../../../testing/factories.js";
import type { BoundApi } from "../../bound.js";
import type { ReviewContextResponse } from "../../types.js";
import { refreshReviewContextCache, reviewQueries } from "./review.js";

const api = {} as BoundApi;

function makeContextResponse(label: string): ReviewContextResponse {
  const generatedAt = "2026-07-15T12:00:00.000Z";

  return {
    text: `context-${label}`,
    markdown: `# Context ${label}`,
    graph: {
      generatedAt,
      root: "/tmp/repo",
      packages: [],
      edges: [],
      fileTree: [],
      changedFiles: [],
    },
    meta: {
      generatedAt,
      root: "/tmp/repo",
      statusHash: `status-${label}`,
      statusHashKind: "full",
      charCount: `context-${label}`.length,
    },
  };
}

describe("reviewQueries.context", () => {
  it("carries no reviewId so a stale refetch cannot relabel today's snapshot as an old review's", () => {
    expect(reviewQueries.context(api).queryKey).toEqual(["review", "context"]);
  });

  it("keeps the ordinary diagnostics read fresh for 60 seconds", () => {
    expect(reviewQueries.context(api).staleTime).toBe(60_000);
  });

  it("replaces a still-fresh snapshot A with B when review completion refreshes the cache", async () => {
    const snapshotA = makeContextResponse("A");
    const snapshotB = makeContextResponse("B");
    const getReviewContext = vi
      .fn<BoundApi["getReviewContext"]>()
      .mockResolvedValueOnce(snapshotA)
      .mockResolvedValueOnce(snapshotB);
    const refreshApi = { getReviewContext } as unknown as BoundApi;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await queryClient.fetchQuery(reviewQueries.context(refreshApi));
    await refreshReviewContextCache(queryClient, refreshApi);

    expect(getReviewContext).toHaveBeenCalledTimes(2);
    expect(queryClient.getQueryData(reviewQueries.context(refreshApi).queryKey)).toEqual(snapshotB);
  });
});

describe("reviewQueries.detail", () => {
  it("namespaces per-review detail keys under a 'detail' discriminator", () => {
    expect(reviewQueries.detail(api, "review-a").queryKey).toEqual([
      "review",
      "detail",
      "review-a",
    ]);
  });

  it("does not collide with the sibling literal keys", () => {
    const detailKey = reviewQueries.detail(api, "context").queryKey;
    const contextKey = reviewQueries.context(api).queryKey;
    const activeSessionKey = reviewQueries.activeSession(api).queryKey;

    expect(detailKey).not.toEqual(contextKey);
    expect(detailKey).not.toEqual(activeSessionKey);
    expect(detailKey[1]).toBe("detail");
  });
});

describe("reviewQueries.list", () => {
  it("does not replay every retained page on a window-focus refetch", () => {
    expect(reviewQueries.list(api).refetchOnWindowFocus).toBe(false);
  });

  it("stays immediately stale so entering history and explicit refresh still refetch", () => {
    expect(reviewQueries.list(api).staleTime).toBe(0);
  });
});

describe("query cancellation", () => {
  it("aborts the in-flight context read when the cache refresh cancels it", async () => {
    const inFlight = createDeferred<ReviewContextResponse>();
    let capturedSignal: AbortSignal | undefined;
    const getReviewContext = vi
      .fn<BoundApi["getReviewContext"]>()
      .mockImplementationOnce((signal) => {
        capturedSignal = signal;
        return inFlight.promise;
      })
      .mockResolvedValue(makeContextResponse("B"));
    const refreshApi = { getReviewContext } as unknown as BoundApi;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const firstFetch = queryClient.fetchQuery(reviewQueries.context(refreshApi)).catch(() => null);
    await vi.waitFor(() => expect(capturedSignal).toBeDefined());
    expect(capturedSignal?.aborted).toBe(false);

    const refresh = refreshReviewContextCache(queryClient, refreshApi);
    expect(capturedSignal?.aborted).toBe(true);

    inFlight.resolve(makeContextResponse("A"));
    await firstFetch;
    expect(await refresh).toEqual(makeContextResponse("B"));
  });

  it("forwards the query signal to the history list and detail reads", async () => {
    const getReviews = vi
      .fn<BoundApi["getReviews"]>()
      .mockResolvedValue({ reviews: [], nextCursor: null });
    const getReview = vi.fn<BoundApi["getReview"]>().mockResolvedValue({
      review: {
        metadata: makeReviewMetadata(),
        result: { issues: [] },
        gitContext: { branch: null, commit: null, fileCount: 0, additions: 0, deletions: 0 },
      },
    });
    const listApi = { getReviews, getReview } as unknown as BoundApi;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await queryClient.fetchInfiniteQuery(reviewQueries.list(listApi));
    await queryClient.fetchQuery(reviewQueries.detail(listApi, "review-a"));

    expect(getReviews.mock.calls[0]?.[1]).toBeInstanceOf(AbortSignal);
    expect(getReview.mock.calls[0]?.[1]).toBeInstanceOf(AbortSignal);
  });
});
