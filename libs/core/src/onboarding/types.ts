import type { AIProvider, AgentExecution, SecretsStorage } from "@diffgazer/core/schemas/config";
import type { LensId } from "@diffgazer/core/schemas/review";

export const INPUT_METHODS = ["paste", "env"] as const;
export type InputMethod = (typeof INPUT_METHODS)[number];

export const WIZARD_STEPS = [
  "storage",
  "provider",
  "api-key",
  "model",
  "analysis",
  "execution",
] as const;
export type OnboardingStep = (typeof WIZARD_STEPS)[number];

export interface WizardData {
  secretsStorage: SecretsStorage;
  provider: AIProvider | null;
  apiKey: string;
  inputMethod: InputMethod;
  model: string | null;
  defaultLenses: LensId[];
  agentExecution: AgentExecution;
}
