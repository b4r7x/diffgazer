/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSubmitGuard } from "./use-submit-guard";

describe("useSubmitGuard", () => {
  it("starts in non-submitting state", () => {
    const { result } = renderHook(() => useSubmitGuard());
    expect(result.current.isSubmitting).toBe(false);
  });

  it("flips isSubmitting to true while the guarded fn is pending and back to false after it settles", async () => {
    const { result } = renderHook(() => useSubmitGuard());

    let resolveFn: (value: string) => void = () => undefined;
    const pending = new Promise<string>((resolve) => {
      resolveFn = resolve;
    });

    let outcome: Promise<string | undefined>;
    act(() => {
      outcome = result.current.withGuard(() => pending);
    });

    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      resolveFn("ok");
      await outcome;
    });

    expect(result.current.isSubmitting).toBe(false);
  });

  it("returns undefined synchronously when a second submit starts while the first is in flight", async () => {
    const { result } = renderHook(() => useSubmitGuard());

    const firstFn = vi.fn().mockResolvedValue("first");
    const secondFn = vi.fn().mockResolvedValue("second");

    let firstResult: Promise<string | undefined>;
    let secondResult: string | undefined;
    await act(async () => {
      firstResult = result.current.withGuard(firstFn);
      secondResult = await result.current.withGuard(secondFn);
      await firstResult;
    });

    expect(secondFn).not.toHaveBeenCalled();
    expect(secondResult).toBeUndefined();
  });

  it("resets after a rejected fn so subsequent submits run", async () => {
    const { result } = renderHook(() => useSubmitGuard());

    const failingFn = vi.fn().mockRejectedValue(new Error("boom"));
    const followUpFn = vi.fn().mockResolvedValue("done");

    await act(async () => {
      await result.current.withGuard(failingFn).catch(() => undefined);
    });
    expect(result.current.isSubmitting).toBe(false);

    await act(async () => {
      const next = await result.current.withGuard(followUpFn);
      expect(next).toBe("done");
    });
    expect(followUpFn).toHaveBeenCalled();
  });
});
