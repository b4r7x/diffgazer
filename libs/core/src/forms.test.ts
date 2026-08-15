/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { deriveSaveState, useSubmitGuard } from "./forms.js";
import { createDeferred } from "./testing/deferred.js";

describe("deriveSaveState", () => {
  it("falls back when nothing is persisted or chosen", () => {
    const state = deriveSaveState({
      persisted: null,
      choice: null,
      saving: false,
      fallback: "file",
    });
    expect(state.effective).toBe("file");
    expect(state.isDirty).toBe(true);
    expect(state.canSave).toBe(true);
  });

  it("uses the persisted value when nothing is chosen and is not dirty", () => {
    const state = deriveSaveState({
      persisted: "keyring",
      choice: null,
      saving: false,
      fallback: "file",
    });
    expect(state.effective).toBe("keyring");
    expect(state.isDirty).toBe(false);
    expect(state.canSave).toBe(false);
  });

  it("becomes dirty after the choice diverges from the persisted value", () => {
    const state = deriveSaveState({
      persisted: "file",
      choice: "keyring",
      saving: false,
      fallback: "file",
    });
    expect(state.effective).toBe("keyring");
    expect(state.isDirty).toBe(true);
    expect(state.canSave).toBe(true);
  });

  it("blocks save while saving even when dirty", () => {
    const state = deriveSaveState({
      persisted: "file",
      choice: "keyring",
      saving: true,
      fallback: "file",
    });
    expect(state.isDirty).toBe(true);
    expect(state.canSave).toBe(false);
  });
});

describe("useSubmitGuard", () => {
  it("starts in non-submitting state", () => {
    const { result } = renderHook(() => useSubmitGuard());
    expect(result.current.isSubmitting).toBe(false);
  });

  it("flips isSubmitting to true while the guarded fn is pending and back to false after it settles", async () => {
    const { result } = renderHook(() => useSubmitGuard());

    const pending = createDeferred<void>();

    let outcome: Promise<boolean>;
    act(() => {
      outcome = result.current.withGuard(() => pending.promise);
    });

    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      pending.resolve();
      await outcome;
    });

    expect(result.current.isSubmitting).toBe(false);
  });

  it("returns false when a second submit starts while the first is in flight", async () => {
    const { result } = renderHook(() => useSubmitGuard());

    const firstFn = vi.fn().mockResolvedValue(undefined);
    const secondFn = vi.fn().mockResolvedValue(undefined);

    let firstResult: Promise<boolean>;
    let secondResult: boolean | undefined;
    await act(async () => {
      firstResult = result.current.withGuard(firstFn);
      secondResult = await result.current.withGuard(secondFn);
      await firstResult;
    });

    expect(secondFn).not.toHaveBeenCalled();
    expect(secondResult).toBe(false);
  });

  it("resets after a rejected fn so subsequent submits run", async () => {
    const { result } = renderHook(() => useSubmitGuard());

    const failingFn = vi.fn().mockRejectedValue(new Error("boom"));
    const followUpFn = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.withGuard(failingFn).catch(() => undefined);
    });
    expect(result.current.isSubmitting).toBe(false);

    await act(async () => {
      const next = await result.current.withGuard(followUpFn);
      expect(next).toBe(true);
    });
    expect(followUpFn).toHaveBeenCalled();
  });
});
