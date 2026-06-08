import { describe, expect, it } from "vitest";
import type { BoundApi } from "../../bound.js";
import { reviewQueries } from "./review.js";

const api = {} as BoundApi;

describe("reviewQueries.context", () => {
  it("keys context snapshots by review id so new runs cannot reuse stale context data", () => {
    expect(reviewQueries.context(api, "review-a").queryKey).toEqual([
      "review",
      "context",
      "review-a",
    ]);
    expect(reviewQueries.context(api, "review-b").queryKey).toEqual([
      "review",
      "context",
      "review-b",
    ]);
  });

  it("keeps a stable key for generic context refresh callers", () => {
    expect(reviewQueries.context(api).queryKey).toEqual(["review", "context", "latest"]);
  });
});
