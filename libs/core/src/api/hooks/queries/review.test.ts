import { describe, expect, it } from "vitest";
import type { BoundApi } from "../../bound.js";
import { reviewQueries } from "./review.js";

const api = {} as BoundApi;

describe("reviewQueries.context", () => {
  it("carries no reviewId so a stale refetch cannot relabel today's snapshot as an old review's", () => {
    expect(reviewQueries.context(api).queryKey).toEqual(["review", "context"]);
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
