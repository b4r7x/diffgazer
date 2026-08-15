import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestQueryWrapper } from "./query-wrapper.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createTestQueryWrapper", () => {
  it("rejects an unstubbed api method by name without reaching the network", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { api } = createTestQueryWrapper({ api: { getReviews: vi.fn() } });

    expect(() => api.getReview("review-1")).toThrow("api.getReview()");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps the supplied overrides callable", async () => {
    const getReviews = vi.fn().mockResolvedValue({ reviews: [] });
    const { api } = createTestQueryWrapper({ api: { getReviews } });

    await expect(api.getReviews()).resolves.toEqual({ reviews: [] });
  });
});
