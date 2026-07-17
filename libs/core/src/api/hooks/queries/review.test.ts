import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
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
