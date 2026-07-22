/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AVAILABLE_PROVIDERS } from "../schemas/config/index.js";
import type { WizardData } from "./types.js";
import { useWizardState, type WizardSaveCallbacks } from "./use-wizard-state.js";

const OPENROUTER_DATA: WizardData = {
  secretsStorage: "file",
  provider: "openrouter",
  apiKey: "test-key",
  inputMethod: "paste",
  model: null,
  defaultLenses: ["security"],
  agentExecution: "sequential",
};

function makeCallbacks(overrides: Partial<WizardSaveCallbacks> = {}): WizardSaveCallbacks {
  return {
    saveSettings: vi.fn().mockResolvedValue(undefined),
    saveConfig: vi.fn().mockResolvedValue(undefined),
    deleteCredentials: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function advanceToEarlySave(result: { current: ReturnType<typeof useWizardState> }) {
  act(() => result.current.next()); // storage -> provider
  act(() => result.current.next()); // provider -> api-key
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("useWizardState", () => {
  it("starts on the first step with default data", () => {
    const { result } = renderHook(() => useWizardState());

    expect(result.current.currentStep).toBe("storage");
    expect(result.current.stepIndex).toBe(0);
    expect(result.current.isFirstStep).toBe(true);
    expect(result.current.isLastStep).toBe(false);
    expect(result.current.wizardData.secretsStorage).toBe("file");
  });

  it("advances to the next step when canProceed is true", () => {
    const { result } = renderHook(() => useWizardState());

    act(() => result.current.next());

    expect(result.current.currentStep).toBe("provider");
    expect(result.current.isFirstStep).toBe(false);
  });

  it("refuses to advance past a blocking step", () => {
    const { result } = renderHook(() =>
      useWizardState({
        initial: {
          secretsStorage: "file",
          provider: null,
          apiKey: "",
          inputMethod: "paste",
          model: null,
          defaultLenses: ["security"],
          agentExecution: "sequential",
        },
      }),
    );

    act(() => result.current.next());
    expect(result.current.currentStep).toBe("provider");

    act(() => result.current.next());
    expect(result.current.currentStep).toBe("provider");
    expect(result.current.canProceed).toBe(false);
  });

  it("steps back but never before the first step", () => {
    const { result } = renderHook(() => useWizardState());

    act(() => result.current.next());
    expect(result.current.currentStep).toBe("provider");

    act(() => result.current.back());
    expect(result.current.currentStep).toBe("storage");

    act(() => result.current.back());
    expect(result.current.currentStep).toBe("storage");
  });

  it("setProvider resets api key, input method, and model to provider default", () => {
    const target = AVAILABLE_PROVIDERS.find((p) => p.id === "zai");
    if (!target) throw new Error("expected zai provider in fixtures");

    const { result } = renderHook(() => useWizardState());

    act(() =>
      result.current.updateData({
        apiKey: "stale",
        inputMethod: "env",
      }),
    );
    act(() => result.current.setProvider("zai"));

    expect(result.current.wizardData.provider).toBe("zai");
    expect(result.current.wizardData.apiKey).toBe("");
    expect(result.current.wizardData.inputMethod).toBe("paste");
    expect(result.current.wizardData.model).toBe(target.defaultModel ?? null);
  });

  it("setProvider sets model to null when the provider has an empty defaultModel", () => {
    const target = AVAILABLE_PROVIDERS.find((p) => p.id === "openrouter");
    if (!target) throw new Error("expected openrouter provider in fixtures");
    expect(target.defaultModel).toBe("");

    const { result } = renderHook(() => useWizardState());

    act(() => result.current.updateData({ model: "stale-model" }));
    act(() => result.current.setProvider("openrouter"));

    expect(result.current.wizardData.provider).toBe("openrouter");
    expect(result.current.wizardData.model).toBeNull();
  });

  it("persists the storage choice before credentials in the early save", async () => {
    const callOrder: string[] = [];
    const callbacks = makeCallbacks({
      saveSettings: vi.fn(async () => {
        callOrder.push("settings");
      }),
      saveConfig: vi.fn(async () => {
        callOrder.push("config");
      }),
    });

    const { result } = renderHook(() => useWizardState({ initial: OPENROUTER_DATA, callbacks }));

    advanceToEarlySave(result);
    await act(async () => result.current.next()); // api-key -> model (early save)

    expect(callOrder).toEqual(["settings", "config"]);
    expect(callbacks.saveSettings).toHaveBeenCalledWith({ secretsStorage: "file" });
    expect(callbacks.saveConfig).toHaveBeenCalledWith({
      provider: "openrouter",
      apiKey: { kind: "literal", value: "test-key" },
    });
    expect(result.current.currentStep).toBe("model");
  });

  it("coalesces rapid next calls during an early save and advances once to model", async () => {
    const saveConfigGate = deferred<void>();
    const callbacks = makeCallbacks({
      saveConfig: vi.fn(() => saveConfigGate.promise),
    });

    const { result } = renderHook(() => useWizardState({ initial: OPENROUTER_DATA, callbacks }));

    advanceToEarlySave(result);

    act(() => {
      result.current.next();
      result.current.next();
    });

    expect(result.current.currentStep).toBe("api-key");
    expect(result.current.isEarlySaving).toBe(true);

    await act(async () => {
      await Promise.resolve();
    });
    expect(callbacks.saveConfig).toHaveBeenCalledTimes(1);

    await act(async () => {
      saveConfigGate.resolve();
    });

    expect(result.current.currentStep).toBe("model");
    expect(result.current.stepIndex).toBe(3);
    expect(callbacks.saveSettings).toHaveBeenCalledTimes(1);
    expect(callbacks.saveConfig).toHaveBeenCalledTimes(1);
  });

  it("captures an early-save failure and clears it on step change", async () => {
    const callbacks = makeCallbacks({
      saveConfig: vi.fn().mockRejectedValue(new Error("STORAGE_NOT_CONFIGURED")),
    });

    const { result } = renderHook(() => useWizardState({ initial: OPENROUTER_DATA, callbacks }));

    advanceToEarlySave(result);
    await act(async () => result.current.next());

    expect(result.current.earlySaveError).toBe("STORAGE_NOT_CONFIGURED");
    expect(result.current.currentStep).toBe("api-key");

    act(() => result.current.back());
    expect(result.current.earlySaveError).toBeNull();
  });

  it("cleanupEarlySave deletes the early-saved credentials and reports failures terminally", async () => {
    const onCleanupError = vi.fn();
    const callbacks = makeCallbacks({
      deleteCredentials: vi
        .fn()
        .mockRejectedValueOnce(new Error("cleanup boom"))
        .mockResolvedValueOnce(undefined),
    });

    const { result } = renderHook(() =>
      useWizardState({ initial: OPENROUTER_DATA, callbacks, onCleanupError }),
    );

    advanceToEarlySave(result);
    await act(async () => result.current.next());

    await act(async () => {
      await result.current.cleanupEarlySave();
    });

    expect(callbacks.deleteCredentials).toHaveBeenCalledWith("openrouter");
    expect(onCleanupError).toHaveBeenCalledWith(
      expect.stringContaining("Failed to remove saved credentials"),
    );
  });

  it("cleanupEarlySave waits for an in-flight early save before deleting the abandoned credentials", async () => {
    const saveConfigGate = deferred<void>();
    const callbacks = makeCallbacks({
      saveConfig: vi.fn(() => saveConfigGate.promise),
    });

    const { result } = renderHook(() => useWizardState({ initial: OPENROUTER_DATA, callbacks }));

    advanceToEarlySave(result);

    act(() => result.current.next());
    expect(result.current.isEarlySaving).toBe(true);
    expect(callbacks.deleteCredentials).not.toHaveBeenCalled();

    let cleanupDone = false;
    const cleanupPromise = result.current.cleanupEarlySave().then(() => {
      cleanupDone = true;
    });

    await Promise.resolve();
    expect(callbacks.deleteCredentials).not.toHaveBeenCalled();
    expect(cleanupDone).toBe(false);

    await act(async () => {
      saveConfigGate.resolve();
      await cleanupPromise;
    });

    expect(callbacks.deleteCredentials).toHaveBeenCalledWith("openrouter");
    expect(cleanupDone).toBe(true);
  });

  it("deletes an early-saved provider before accepting and completing with another provider", async () => {
    const deleteGate = deferred<void>();
    const callbacks = makeCallbacks({
      deleteCredentials: vi.fn(() => deleteGate.promise),
    });
    const { result } = renderHook(() => useWizardState({ initial: OPENROUTER_DATA, callbacks }));

    advanceToEarlySave(result);
    await act(async () => result.current.next());
    act(() => result.current.back());
    act(() => result.current.back());

    act(() => result.current.setProvider("gemini"));
    expect(result.current.isEarlySaving).toBe(true);
    expect(result.current.wizardData.provider).toBe("openrouter");
    expect(callbacks.deleteCredentials).toHaveBeenCalledWith("openrouter");

    await act(async () => deleteGate.resolve());
    expect(result.current.wizardData.provider).toBe("gemini");
    expect(result.current.isEarlySaving).toBe(false);

    await act(async () => {
      await result.current.complete();
    });

    expect(callbacks.deleteCredentials).toHaveBeenCalledTimes(1);
    expect(callbacks.saveConfig).toHaveBeenLastCalledWith(
      expect.objectContaining({ provider: "gemini" }),
    );
    const deleteOrder = vi.mocked(callbacks.deleteCredentials).mock.invocationCallOrder[0];
    const finalSaveOrder = vi.mocked(callbacks.saveConfig).mock.invocationCallOrder.at(-1);
    expect(deleteOrder).toBeLessThan(finalSaveOrder ?? Number.POSITIVE_INFINITY);
  });

  it("retains the early-saved provider marker until provider-switch deletion succeeds", async () => {
    const callbacks = makeCallbacks({
      deleteCredentials: vi
        .fn()
        .mockRejectedValueOnce(new Error("delete failed"))
        .mockResolvedValueOnce(undefined),
    });
    const { result } = renderHook(() => useWizardState({ initial: OPENROUTER_DATA, callbacks }));

    advanceToEarlySave(result);
    await act(async () => result.current.next());
    act(() => result.current.back());
    act(() => result.current.back());

    await act(async () => {
      result.current.setProvider("gemini");
      await Promise.resolve();
    });
    expect(result.current.wizardData.provider).toBe("openrouter");
    expect(result.current.earlySaveError).toContain("delete failed");

    await act(async () => {
      result.current.setProvider("gemini");
      await Promise.resolve();
    });
    expect(callbacks.deleteCredentials).toHaveBeenCalledTimes(2);
    expect(result.current.wizardData.provider).toBe("gemini");
    expect(result.current.earlySaveError).toBeNull();
  });

  it("complete runs the final config save then onComplete, and resolves true", async () => {
    const callOrder: string[] = [];
    const onComplete = vi.fn(async () => {
      callOrder.push("onComplete");
    });
    const callbacks = makeCallbacks({
      saveConfig: vi.fn(async () => {
        callOrder.push("config");
      }),
    });

    const { result } = renderHook(() =>
      useWizardState({
        initial: {
          ...OPENROUTER_DATA,
          provider: "gemini",
          model: "gemini-2.5-pro",
        },
        callbacks,
        onComplete,
      }),
    );

    let success = false;
    await act(async () => {
      success = await result.current.complete();
    });

    expect(success).toBe(true);
    expect(callOrder).toEqual(["config", "onComplete"]);
  });

  it("complete reports a save failure in error state and resolves false", async () => {
    const onComplete = vi.fn();
    const callbacks = makeCallbacks({
      saveSettings: vi.fn().mockRejectedValue(new Error("boom")),
    });

    const { result } = renderHook(() =>
      useWizardState({
        initial: { ...OPENROUTER_DATA, provider: "gemini", model: "gemini-2.5-pro" },
        callbacks,
        onComplete,
      }),
    );

    let success = true;
    await act(async () => {
      success = await result.current.complete();
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe("boom");
    expect(onComplete).not.toHaveBeenCalled();
  });
});
