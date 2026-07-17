import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useApiKeyForm } from "./use-form";

function defaultProps(overrides: Partial<Parameters<typeof useApiKeyForm>[0]> = {}) {
  return {
    envVarName: "OPENAI_API_KEY",
    onSubmit: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

type CanSubmitCase = {
  method: "env" | "paste";
  keyValue: string;
  canSubmit: boolean;
};

describe("useApiKeyForm", () => {
  it.each<CanSubmitCase>([
    { method: "env", keyValue: "", canSubmit: true },
    { method: "paste", keyValue: "sk-abc123", canSubmit: true },
    { method: "paste", keyValue: "", canSubmit: false },
  ])("reports canSubmit=$canSubmit when method=$method and keyValue=$keyValue", ({
    method,
    keyValue,
    canSubmit,
  }) => {
    const { result } = renderHook(() => useApiKeyForm(defaultProps()));

    act(() => {
      result.current.setMethod(method);
      result.current.setKeyValue(keyValue);
    });

    expect(result.current.canSubmit).toBe(canSubmit);
  });

  it("uses an explicit submit method instead of the current render snapshot", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useApiKeyForm(defaultProps({ onSubmit })));

    await act(async () => {
      await result.current.handleSubmit("env");
    });

    expect(onSubmit).toHaveBeenCalledWith("env", "OPENAI_API_KEY");
  });

  it("passes env method and var name so callers can construct a CredentialRef", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useApiKeyForm(defaultProps({ onSubmit, envVarName: "OPENROUTER_API_KEY" })),
    );

    await act(async () => {
      await result.current.handleSubmit("env");
    });

    expect(onSubmit).toHaveBeenCalledWith("env", "OPENROUTER_API_KEY");

    // Verify the caller can transform to CredentialRef as page.tsx now does
    const [method, value] = onSubmit.mock.calls[0] as [string, string];
    const credentialRef = method === "env" ? { kind: "env" as const, varName: value } : value;
    expect(credentialRef).toEqual({ kind: "env", varName: "OPENROUTER_API_KEY" });
  });

  it("declines a concurrent save without clearing the form", async () => {
    let resolveSubmit!: (committed: boolean) => void;
    const onSubmit = vi.fn().mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    const { result } = renderHook(() => useApiKeyForm(defaultProps({ onSubmit })));

    act(() => result.current.setKeyValue("sk-kept"));

    let submitPromise!: Promise<boolean>;
    let duplicatePromise!: Promise<boolean>;
    act(() => {
      submitPromise = result.current.handleSubmit();
      duplicatePromise = result.current.handleSubmit();
    });

    expect(result.current.isSubmitting).toBe(true);
    expect(onSubmit).toHaveBeenCalledOnce();

    await expect(duplicatePromise).resolves.toBe(false);
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(result.current.keyValue).toBe("sk-kept");

    await act(async () => {
      resolveSubmit(true);
      await expect(submitPromise).resolves.toBe(true);
    });

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.keyValue).toBe("");
  });

  it("exposes the failure message when handleSubmit rejects", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useApiKeyForm(defaultProps({ onSubmit })));

    act(() => result.current.setMethod("env"));

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.error).toBe("Network error");
    expect(result.current.isSubmitting).toBe(false);
  });

  it("keeps the typed key after a failed paste submit", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useApiKeyForm(defaultProps({ onSubmit })));

    act(() => result.current.setKeyValue("sk-test-key"));

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.keyValue).toBe("sk-test-key");
  });

  it("clears the keyValue after a successful submit", async () => {
    const { result } = renderHook(() => useApiKeyForm(defaultProps()));

    act(() => result.current.setKeyValue("sk-test-key"));
    expect(result.current.keyValue).toBe("sk-test-key");

    let saved = false;
    await act(async () => {
      saved = await result.current.handleSubmit();
    });

    expect(saved).toBe(true);
    expect(result.current.keyValue).toBe("");
  });
});
