import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useReviewStart } from "./use-review-start";
import { ReviewErrorCode } from "@stargazer/schemas/review";
import type { Result } from "@stargazer/core/result";
import type { StreamReviewError } from "@stargazer/api/review";

function defaultProps(overrides: Partial<Parameters<typeof useReviewStart>[0]> = {}) {
  return {
    mode: "staged" as const,
    configLoading: false,
    settingsLoading: false,
    isConfigured: true,
    defaultLenses: [],
    reviewId: undefined,
    start: vi.fn<Parameters<typeof useReviewStart>[0]["start"]>().mockResolvedValue(undefined),
    resume: vi.fn<Parameters<typeof useReviewStart>[0]["resume"]>().mockResolvedValue({ ok: true, value: undefined } as Result<void, StreamReviewError>),
    onResumeFailed: vi.fn(),
    ...overrides,
  };
}

describe("useReviewStart", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should start review when config is ready and no reviewId", async () => {
    const start = vi.fn().mockResolvedValue(undefined);
    const props = defaultProps({ start });

    renderHook(() => useReviewStart(props));

    // start is called asynchronously inside useEffect
    await vi.waitFor(() => {
      expect(start).toHaveBeenCalledOnce();
    });
    expect(start).toHaveBeenCalledWith({ mode: "staged", lenses: [] });
  });

  it("should resume review when reviewId is present", async () => {
    const resume = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const props = defaultProps({ reviewId: "existing-id", resume });

    renderHook(() => useReviewStart(props));

    await vi.waitFor(() => {
      expect(resume).toHaveBeenCalledOnce();
    });
    expect(resume).toHaveBeenCalledWith("existing-id");
  });

  it("should fall back to start on SESSION_STALE resume error", async () => {
    const start = vi.fn().mockResolvedValue(undefined);
    const resume = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: ReviewErrorCode.SESSION_STALE, message: "stale" },
    });
    const props = defaultProps({ reviewId: "stale-id", start, resume });

    renderHook(() => useReviewStart(props));

    await vi.waitFor(() => {
      expect(start).toHaveBeenCalledOnce();
    });
    expect(start).toHaveBeenCalledWith({ mode: "staged", lenses: [] });
  });

  it("should call onResumeFailed on SESSION_NOT_FOUND", async () => {
    const onResumeFailed = vi.fn();
    const resume = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: ReviewErrorCode.SESSION_NOT_FOUND, message: "not found" },
    });
    const props = defaultProps({ reviewId: "missing-id", resume, onResumeFailed });

    renderHook(() => useReviewStart(props));

    await vi.waitFor(() => {
      expect(onResumeFailed).toHaveBeenCalledOnce();
    });
    expect(onResumeFailed).toHaveBeenCalledWith({
      issues: [],
      reviewId: "missing-id",
      resumeFailed: true,
    });
  });
});
