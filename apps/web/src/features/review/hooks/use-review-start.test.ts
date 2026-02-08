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
    getActiveSession: vi.fn<Parameters<typeof useReviewStart>[0]["getActiveSession"]>().mockResolvedValue({ session: null }),
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
    const getActiveSession = vi.fn().mockResolvedValue({ session: null });
    const props = defaultProps({ start, getActiveSession });

    renderHook(() => useReviewStart(props));

    // start is called asynchronously inside useEffect
    await vi.waitFor(() => {
      expect(start).toHaveBeenCalledOnce();
    });
    expect(getActiveSession).toHaveBeenCalledWith("staged");
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

  it("should auto-resume active session when reviewId is not in URL", async () => {
    const resume = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const getActiveSession = vi.fn().mockResolvedValue({
      session: { reviewId: "active-id" },
    });
    const props = defaultProps({ resume, getActiveSession });

    renderHook(() => useReviewStart(props));

    await vi.waitFor(() => {
      expect(resume).toHaveBeenCalledOnce();
    });
    expect(getActiveSession).toHaveBeenCalledWith("staged");
    expect(resume).toHaveBeenCalledWith("active-id");
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

  it("should start fresh when active session no longer exists", async () => {
    const start = vi.fn().mockResolvedValue(undefined);
    const resume = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: ReviewErrorCode.SESSION_NOT_FOUND, message: "not found" },
    });
    const getActiveSession = vi.fn().mockResolvedValue({
      session: { reviewId: "missing-active-id" },
    });
    const onResumeFailed = vi.fn();
    const props = defaultProps({
      start,
      resume,
      getActiveSession,
      onResumeFailed,
    });

    renderHook(() => useReviewStart(props));

    await vi.waitFor(() => {
      expect(start).toHaveBeenCalledOnce();
    });
    expect(onResumeFailed).not.toHaveBeenCalled();
  });

  it("should start fresh when active session becomes stale", async () => {
    const start = vi.fn().mockResolvedValue(undefined);
    const resume = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: ReviewErrorCode.SESSION_STALE, message: "stale" },
    });
    const getActiveSession = vi.fn().mockResolvedValue({
      session: { reviewId: "stale-active-id" },
    });
    const onResumeFailed = vi.fn();
    const props = defaultProps({
      start,
      resume,
      getActiveSession,
      onResumeFailed,
    });

    renderHook(() => useReviewStart(props));

    await vi.waitFor(() => {
      expect(start).toHaveBeenCalledOnce();
    });
    expect(onResumeFailed).not.toHaveBeenCalled();
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
