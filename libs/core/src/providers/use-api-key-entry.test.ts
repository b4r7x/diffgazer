/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useApiKeyEntry } from "./use-api-key-entry.js";

describe("useApiKeyEntry", () => {
  it("submits the typed key in paste mode and clears the value", async () => {
    const onSubmit = vi.fn(async () => true);
    const { result } = renderHook(() => useApiKeyEntry({ onSubmit }));

    expect(result.current.canSubmit).toBe(false);
    await act(async () => {
      expect(await result.current.submit()).toBe(false);
    });
    expect(onSubmit).not.toHaveBeenCalled();

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

  it("uses an explicit submit method instead of the current render snapshot", async () => {
    const onSubmit = vi.fn(async () => true);
    const { result } = renderHook(() => useApiKeyEntry({ onSubmit }));

    act(() => result.current.setValue("OPENAI_API_KEY"));
    await act(async () => {
      await result.current.submit("env");
    });

    expect(onSubmit).toHaveBeenCalledWith("env", "OPENAI_API_KEY");
  });

  it("captures a failed submit and clears it on the next input change", async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error("save boom"));
    const { result } = renderHook(() => useApiKeyEntry({ onSubmit }));

    act(() => result.current.setValue("sk-test"));
    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.error).toBe("save boom");
    expect(result.current.value).toBe("sk-test");
    expect(result.current.isSubmitting).toBe(false);

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

    expect(result.current.isSubmitting).toBe(true);
    expect(onSubmit).toHaveBeenCalledOnce();
    await expect(duplicatePromise).resolves.toBe(false);
    expect(result.current.value).toBe("sk-kept");

    await act(async () => {
      resolveSubmit(true);
      await expect(submitPromise).resolves.toBe(true);
    });
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.value).toBe("");
  });

  it("submits the typed value as the env var name in env mode", async () => {
    const onSubmit = vi.fn(async () => true);
    const { result } = renderHook(() => useApiKeyEntry({ onSubmit }));

    act(() => result.current.setMethod("env"));
    expect(result.current.canSubmit).toBe(true);

    act(() => result.current.setValue("MY_KEY_VAR"));
    await act(async () => {
      await result.current.submit();
    });

    expect(onSubmit).toHaveBeenCalledWith("env", "MY_KEY_VAR");
  });

  it("reset restores the initial entry state after a failed submit", async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error("save boom"));
    const { result } = renderHook(() => useApiKeyEntry({ onSubmit }));

    act(() => {
      result.current.setMethod("env");
      result.current.setValue("typed");
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.error).toBe("save boom");

    act(() => result.current.reset());

    expect(result.current.method).toBe("paste");
    expect(result.current.value).toBe("");
    expect(result.current.error).toBeNull();
  });

  it("routes env-method saves through the same guard and error channel", async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error("env save failed"));
    const { result } = renderHook(() => useApiKeyEntry({ onSubmit }));

    await act(async () => {
      await result.current.submit("env");
    });

    expect(onSubmit).toHaveBeenCalledWith("env", "");
    expect(result.current.error).toBe("env save failed");
    expect(result.current.isSubmitting).toBe(false);
  });

  it("declines a duplicate submit while the first save is pending", async () => {
    let resolveSubmit!: (committed: boolean) => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    const { result } = renderHook(() => useApiKeyEntry({ onSubmit }));

    let submitPromise!: Promise<boolean>;
    let duplicatePromise!: Promise<boolean>;
    act(() => {
      submitPromise = result.current.submit("env");
      duplicatePromise = result.current.submit("env");
    });

    expect(result.current.isSubmitting).toBe(true);
    expect(onSubmit).toHaveBeenCalledOnce();
    await expect(duplicatePromise).resolves.toBe(false);

    await act(async () => {
      resolveSubmit(true);
      await expect(submitPromise).resolves.toBe(true);
    });
    expect(result.current.isSubmitting).toBe(false);
  });
});
