/**
 * @vitest-environment jsdom
 */
import { createElement, StrictMode, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@diffgazer/core/result";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { useReviewStart, type UseReviewStartOptions } from "./use-review-start.js";

function StrictModeWrapper({ children }: { children: ReactNode }) {
  return createElement(StrictMode, null, children);
}

function createOptions(
  overrides: Partial<UseReviewStartOptions> = {},
): UseReviewStartOptions {
  return {
    mode: "unstaged",
    configLoading: false,
    settingsLoading: false,
    isConfigured: true,
    defaultLenses: ["correctness"],
    start: vi.fn<UseReviewStartOptions["start"]>().mockResolvedValue(undefined),
    resume: vi.fn<UseReviewStartOptions["resume"]>().mockResolvedValue(ok(undefined)),
    getActiveSession: vi
      .fn<UseReviewStartOptions["getActiveSession"]>()
      .mockResolvedValue({ session: null }),
    ...overrides,
  };
}

describe("useReviewStart", () => {
  it("starts a fresh review after the StrictMode effect probe", async () => {
    const options = createOptions();

    const { result } = renderHook(() => useReviewStart(options), {
      wrapper: StrictModeWrapper,
    });

    expect(result.current.hasStarted).toBe(false);

    await waitFor(() => expect(options.start).toHaveBeenCalledTimes(1));

    expect(options.start).toHaveBeenCalledWith({
      mode: "unstaged",
      lenses: ["correctness"],
    });
    expect(result.current.hasStarted).toBe(true);
    expect(result.current.hasStreamed).toBe(true);
  });

  it("resumes an active review session instead of starting a new review", async () => {
    const options = createOptions({
      getActiveSession: vi
        .fn<UseReviewStartOptions["getActiveSession"]>()
        .mockResolvedValue({ session: { reviewId: "active-review" } }),
    });

    renderHook(() => useReviewStart(options), {
      wrapper: StrictModeWrapper,
    });

    await waitFor(() => expect(options.resume).toHaveBeenCalledTimes(1));

    expect(options.resume).toHaveBeenCalledWith("active-review");
    expect(options.start).not.toHaveBeenCalled();
  });

  it.each([
    ReviewErrorCode.SESSION_STALE,
    ReviewErrorCode.SESSION_NOT_FOUND,
  ])("starts fresh when an active session resume returns %s", async (code) => {
    const options = createOptions({
      resume: vi
        .fn<UseReviewStartOptions["resume"]>()
        .mockResolvedValue(err({ code, message: "Cannot resume active session" })),
      getActiveSession: vi
        .fn<UseReviewStartOptions["getActiveSession"]>()
        .mockResolvedValue({ session: { reviewId: "active-review" } }),
    });

    renderHook(() => useReviewStart(options), {
      wrapper: StrictModeWrapper,
    });

    await waitFor(() => expect(options.start).toHaveBeenCalledTimes(1));

    expect(options.resume).toHaveBeenCalledWith("active-review");
    expect(options.start).toHaveBeenCalledWith({
      mode: "unstaged",
      lenses: ["correctness"],
    });
  });
});
