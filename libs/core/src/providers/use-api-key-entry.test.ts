/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useApiKeyEntry } from "./use-api-key-entry.js";

describe("useApiKeyEntry", () => {
  it("submits the typed key in paste mode and clears the value", async () => {
    const onSubmit = vi.fn(async () => {});
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
    const onSubmit = vi.fn(async () => {});
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

  it("treats the typed value as the env var when no fixed name is provided", async () => {
    const onSubmit = vi.fn(async () => {});
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
    const onSubmit = vi.fn(async () => {});
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
