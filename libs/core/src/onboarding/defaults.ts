import { AVAILABLE_PROVIDERS } from "@diffgazer/core/schemas/config";
import { LENS_IDS } from "@diffgazer/core/schemas/review";
import type { WizardData } from "./types";

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
