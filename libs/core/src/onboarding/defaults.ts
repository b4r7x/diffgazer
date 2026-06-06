import { AVAILABLE_PROVIDERS } from "../schemas/config/index.js";
import { LENS_IDS } from "../schemas/review/index.js";
import type { WizardData } from "./types.js";

export function getInitialWizardData(): WizardData {
  const firstProvider = AVAILABLE_PROVIDERS[0];
  return {
    secretsStorage: "file",
    provider: firstProvider?.id ?? null,
    apiKey: "",
    inputMethod: "paste",
    model: firstProvider?.defaultModel ?? null,
    defaultLenses: [...LENS_IDS],
    agentExecution: "sequential",
  };
}
