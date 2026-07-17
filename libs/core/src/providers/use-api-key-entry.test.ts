/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useApiKeyEntry } from "./use-api-key-entry.js";

describe("useApiKeyEntry", () => {
  it("submits the typed key in paste mode and clears the value", async () => {
    const onSubmit = vi.fn(async () => true);
    const { result } = renderHook(() => useApiKeyEntry({ envVarName: "OPENAI_API_KEY", onSubmit }));

    act(() => result.current.setValue("sk-test"));
    expect(result.current.canSubmit).toBe(true);

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.submit();
    });

    expect(ok).toBe(true);
    expect(onSubmit).toHaveBeenCalledWith("paste", "sk-test");
    expect(result.current.value).toBe("");
  });

  it("submits the fixed env var name in env mode", async () => {
    const onSubmit = vi.fn(async () => true);
    const { result } = renderHook(() => useApiKeyEntry({ envVarName: "OPENAI_API_KEY", onSubmit }));

    act(() => result.current.setMethod("env"));
    expect(result.current.canSubmit).toBe(true);

    await act(async () => {
      await result.current.submit();
    });

    expect(onSubmit).toHaveBeenCalledWith("env", "OPENAI_API_KEY");
  });

  it("captures a failed submit and clears it on the next input change", async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error("save boom"));
    const { result } = renderHook(() => useApiKeyEntry({ envVarName: "OPENAI_API_KEY", onSubmit }));

    act(() => result.current.setValue("sk-test"));
    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.error).toBe("save boom");

    act(() => result.current.setValue("sk-retry"));
    expect(result.current.error).toBeNull();
  });

  it("keeps the value when the submit owner declines the save", async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    const { result } = renderHook(() => useApiKeyEntry({ onSubmit }));

    act(() => result.current.setValue("sk-kept"));
    let committed: boolean | undefined;
    await act(async () => {
      committed = await result.current.submit();
    });

    expect(committed).toBe(false);
    expect(result.current.value).toBe("sk-kept");
    expect(result.current.error).toBeNull();
  });

  it("declines a same-tick duplicate while the first submit is pending", async () => {
    let resolveSubmit!: (committed: boolean) => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    const { result } = renderHook(() => useApiKeyEntry({ onSubmit }));
    act(() => result.current.setValue("sk-kept"));

    let submitPromise!: Promise<boolean>;
    let duplicatePromise!: Promise<boolean>;
    act(() => {
      submitPromise = result.current.submit();
      duplicatePromise = result.current.submit();
    });

    expect(onSubmit).toHaveBeenCalledOnce();
    await expect(duplicatePromise).resolves.toBe(false);
    expect(result.current.value).toBe("sk-kept");

    await act(async () => {
      resolveSubmit(true);
      await expect(submitPromise).resolves.toBe(true);
    });
    expect(result.current.value).toBe("");
  });

  it("treats the typed value as the env var when no fixed name is provided", async () => {
    const onSubmit = vi.fn(async () => true);
    const { result } = renderHook(() => useApiKeyEntry({ onSubmit }));

    act(() => result.current.setMethod("env"));
    expect(result.current.canSubmit).toBe(false);

    act(() => result.current.setValue("MY_KEY_VAR"));
    await act(async () => {
      await result.current.submit();
    });

    expect(onSubmit).toHaveBeenCalledWith("env", "MY_KEY_VAR");
  });

  it("reset restores the initial entry state", () => {
    const onSubmit = vi.fn(async () => true);
    const { result } = renderHook(() => useApiKeyEntry({ envVarName: "X", onSubmit }));

    act(() => {
      result.current.setMethod("env");
      result.current.setValue("typed");
    });
    act(() => result.current.reset());

    expect(result.current.method).toBe("paste");
    expect(result.current.value).toBe("");
    expect(result.current.error).toBeNull();
  });
});
