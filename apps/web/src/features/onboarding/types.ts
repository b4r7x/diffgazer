import type { AIProvider, SecretsStorage, AgentExecution } from "@diffgazer/schemas/config";
import type { LensId } from "@diffgazer/schemas/review";
import type { InputMethod } from "@/types/input-method";

export type OnboardingStep =
  | "storage"
  | "provider"
  | "api-key"
  | "model"
  | "analysis"
  | "execution";

export interface WizardData {
  secretsStorage: SecretsStorage;
  provider: AIProvider | null;
  apiKey: string;
  inputMethod: InputMethod;
  model: string | null;
  defaultLenses: LensId[];
  agentExecution: AgentExecution;
}

export function canProceed(step: OnboardingStep, data: WizardData): boolean {
  switch (step) {
    case "storage":
      return true;
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
