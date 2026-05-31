import type { OnboardingStep, WizardData } from "./types.js";

export function canProceed(step: OnboardingStep, data: WizardData): boolean {
  switch (step) {
    case "storage":
      return data.secretsStorage !== null;
    case "provider":
      return data.provider !== null;
    case "api-key":
      return data.inputMethod === "env" || data.apiKey.length > 0;
    case "model":
      return data.model !== null;
    case "analysis":
      return data.defaultLenses.length > 0;
    case "execution":
      return true;
  }
}
