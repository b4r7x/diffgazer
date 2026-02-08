import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useApiKeyForm } from "./use-api-key-form";

function defaultProps(overrides: Partial<Parameters<typeof useApiKeyForm>[0]> = {}) {
  return {
    envVarName: "OPENAI_API_KEY",
    onSubmit: vi.fn().mockResolvedValue(undefined),
    onOpenChange: vi.fn(),
    ...overrides,
  };
}

describe("useApiKeyForm", () => {
  it("should have canSubmit true when method is env", () => {
    const { result } = renderHook(() => useApiKeyForm(defaultProps()));

    // Default method is "paste" with empty value, so canSubmit is false
    expect(result.current.canSubmit).toBe(false);

    // Switch to env
    act(() => result.current.setMethod("env"));
    expect(result.current.canSubmit).toBe(true);
  });

  it("should have canSubmit true when method is paste and value non-empty", () => {
    const { result } = renderHook(() => useApiKeyForm(defaultProps()));

    act(() => result.current.setKeyValue("sk-abc123"));
    expect(result.current.canSubmit).toBe(true);
  });

  it("should have canSubmit false when method is paste and value empty", () => {
    const { result } = renderHook(() => useApiKeyForm(defaultProps()));

    expect(result.current.method).toBe("paste");
    expect(result.current.keyValue).toBe("");
    expect(result.current.canSubmit).toBe(false);
  });

  it("should prevent double submission", async () => {
    let resolveSubmit!: () => void;
    const onSubmit = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolveSubmit = resolve; })
    );
    const { result } = renderHook(() =>
      useApiKeyForm(defaultProps({ onSubmit }))
    );

    // Set method to env so canSubmit is true and value check passes
    act(() => result.current.setMethod("env"));

    // First submission
    let submitPromise: Promise<void>;
    act(() => {
      submitPromise = result.current.handleSubmit();
    });

    expect(result.current.isSubmitting).toBe(true);
    expect(onSubmit).toHaveBeenCalledOnce();

    // Second submission while first is in flight — should be ignored
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(onSubmit).toHaveBeenCalledOnce();

    // Resolve the first submission
    await act(async () => {
      resolveSubmit();
      await submitPromise!;
    });

    expect(result.current.isSubmitting).toBe(false);
  });

  it("should call onRemoveKey and close dialog on handleRemove", async () => {
    const onRemoveKey = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    const { result } = renderHook(() =>
      useApiKeyForm(defaultProps({ onRemoveKey, onOpenChange }))
    );

    await act(async () => {
      await result.current.handleRemove();
    });

    expect(onRemoveKey).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("should set error state when handleSubmit fails", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() =>
      useApiKeyForm(defaultProps({ onSubmit }))
    );

    act(() => result.current.setMethod("env"));

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.error).toBe("Network error");
    expect(result.current.isSubmitting).toBe(false);
  });

  it("should clear keyValue on successful submit", async () => {
    const { result } = renderHook(() => useApiKeyForm(defaultProps()));

    act(() => result.current.setKeyValue("sk-test-key"));
    expect(result.current.keyValue).toBe("sk-test-key");

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.keyValue).toBe("");
  });
});
