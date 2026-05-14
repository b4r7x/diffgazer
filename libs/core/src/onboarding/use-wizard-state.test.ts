/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AVAILABLE_PROVIDERS } from "@diffgazer/core/schemas/config";
import { useWizardState } from "./use-wizard-state.js";

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
        secretsStorage: "file",
        provider: null,
        apiKey: "",
        inputMethod: "paste",
        model: null,
        defaultLenses: ["security"],
        agentExecution: "sequential",
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
    // OpenRouter ships with `defaultModel: ""` because the user must pick a
    // model on the next step. The wizard must treat an empty default as
    // "no default" and surface `null`, not `""`, so downstream validators
    // (canProceed, save-wizard, server schemas) reject "no model" correctly.
    const target = AVAILABLE_PROVIDERS.find((p) => p.id === "openrouter");
    if (!target) throw new Error("expected openrouter provider in fixtures");
    expect(target.defaultModel).toBe("");

    const { result } = renderHook(() => useWizardState());

    act(() =>
      result.current.updateData({
        // Seed a stale model so we can prove setProvider clears it.
        model: "stale-model",
      }),
    );
    act(() => result.current.setProvider("openrouter"));

    expect(result.current.wizardData.provider).toBe("openrouter");
    expect(result.current.wizardData.model).toBeNull();
  });

  it("updateData merges partial fields without dropping the rest", () => {
    const { result } = renderHook(() => useWizardState());

    act(() => result.current.updateData({ defaultLenses: ["security"] }));

    expect(result.current.wizardData.defaultLenses).toEqual(["security"]);
    expect(result.current.wizardData.secretsStorage).toBe("file");
  });

  it("reaches the last step and reports it", () => {
    const { result } = renderHook(() =>
      useWizardState({
        secretsStorage: "file",
        provider: "gemini",
        apiKey: "key",
        inputMethod: "paste",
        model: "gemini-2.5-pro",
        defaultLenses: ["security"],
        agentExecution: "sequential",
      }),
    );

    for (let i = 0; i < 5; i++) act(() => result.current.next());

    expect(result.current.currentStep).toBe("execution");
    expect(result.current.isLastStep).toBe(true);

    act(() => result.current.next());
    expect(result.current.currentStep).toBe("execution");
  });
});
