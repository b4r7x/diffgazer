import { describe, expect, it } from "vitest";
import type { WizardData } from "@diffgazer/core/onboarding";
import { createInitialState, onboardingReducer, type OnboardingState } from "./onboarding-reducer";

const WIZARD_DATA: WizardData = {
  secretsStorage: null,
  provider: "gemini",
  apiKey: "",
  inputMethod: "paste",
  model: "gemini-2.5-flash",
  defaultLenses: ["security"],
  agentExecution: "sequential",
};

function makeState(overrides: Partial<OnboardingState> = {}): OnboardingState {
  return { ...createInitialState(WIZARD_DATA), ...overrides };
}

describe("onboardingReducer", () => {
  it("starts at step 0 with no pending state", () => {
    const state = createInitialState(WIZARD_DATA);
    expect(state).toEqual({
      wizardData: WIZARD_DATA,
      stepIndex: 0,
      isSubmitting: false,
      isEarlySaving: false,
      error: null,
    });
  });

  it("advances and walks back through steps", () => {
    let state = makeState();
    state = onboardingReducer(state, { type: "advanceStep" });
    state = onboardingReducer(state, { type: "advanceStep" });
    expect(state.stepIndex).toBe(2);

    state = onboardingReducer(state, { type: "back" });
    expect(state.stepIndex).toBe(1);
  });

  it("merges partial wizard data without dropping other fields", () => {
    const state = onboardingReducer(makeState(), {
      type: "updateData",
      partial: { apiKey: "sk-123" },
    });
    expect(state.wizardData.apiKey).toBe("sk-123");
    expect(state.wizardData.provider).toBe("gemini");
  });

  it("resets api key and input method when the provider changes", () => {
    const dirty = makeState({
      wizardData: { ...WIZARD_DATA, apiKey: "sk-old", inputMethod: "env" },
    });
    const state = onboardingReducer(dirty, {
      type: "setProvider",
      provider: "openrouter",
      model: "openai/gpt-4o",
    });
    expect(state.wizardData.provider).toBe("openrouter");
    expect(state.wizardData.model).toBe("openai/gpt-4o");
    expect(state.wizardData.apiKey).toBe("");
    expect(state.wizardData.inputMethod).toBe("paste");
  });

  it("startSubmit sets submitting and clears any prior error atomically", () => {
    const withError = makeState({ error: "previous failure" });
    const state = onboardingReducer(withError, { type: "startSubmit" });
    expect(state.isSubmitting).toBe(true);
    expect(state.error).toBeNull();
  });

  it("endSubmit clears submitting but preserves an error set during submission", () => {
    let state = onboardingReducer(makeState(), { type: "startSubmit" });
    state = onboardingReducer(state, { type: "setError", error: "Setup failed" });
    state = onboardingReducer(state, { type: "endSubmit" });
    expect(state.isSubmitting).toBe(false);
    expect(state.error).toBe("Setup failed");
  });

  it("startEarlySave sets the early-saving flag and clears prior errors", () => {
    const withError = makeState({ error: "stale" });
    const started = onboardingReducer(withError, { type: "startEarlySave" });
    expect(started.isEarlySaving).toBe(true);
    expect(started.error).toBeNull();

    const ended = onboardingReducer(started, { type: "endEarlySave" });
    expect(ended.isEarlySaving).toBe(false);
  });
});
