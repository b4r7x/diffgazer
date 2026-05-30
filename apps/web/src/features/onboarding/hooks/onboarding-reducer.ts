import type { AIProvider } from "@diffgazer/core/schemas/config";
import type { WizardData } from "@diffgazer/core/onboarding";

export interface OnboardingState {
  wizardData: WizardData;
  stepIndex: number;
  isSubmitting: boolean;
  isEarlySaving: boolean;
  error: string | null;
}

export type OnboardingAction =
  | { type: "advanceStep" }
  | { type: "back" }
  | { type: "updateData"; partial: Partial<WizardData> }
  | { type: "setProvider"; provider: AIProvider; model: string | null }
  | { type: "setError"; error: string | null }
  | { type: "startEarlySave" }
  | { type: "endEarlySave" }
  | { type: "startSubmit" }
  | { type: "endSubmit" };

export function createInitialState(wizardData: WizardData): OnboardingState {
  return {
    wizardData,
    stepIndex: 0,
    isSubmitting: false,
    isEarlySaving: false,
    error: null,
  };
}

export function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case "advanceStep":
      return { ...state, stepIndex: state.stepIndex + 1 };
    case "back":
      return { ...state, stepIndex: state.stepIndex - 1 };
    case "updateData":
      return { ...state, wizardData: { ...state.wizardData, ...action.partial } };
    case "setProvider":
      return {
        ...state,
        wizardData: {
          ...state.wizardData,
          provider: action.provider,
          model: action.model,
          apiKey: "",
          inputMethod: "paste",
        },
      };
    case "setError":
      return { ...state, error: action.error };
    case "startEarlySave":
      return { ...state, isEarlySaving: true, error: null };
    case "endEarlySave":
      return { ...state, isEarlySaving: false };
    case "startSubmit":
      return { ...state, isSubmitting: true, error: null };
    case "endSubmit":
      return { ...state, isSubmitting: false };
  }
}
