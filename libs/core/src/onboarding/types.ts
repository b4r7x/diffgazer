import type { AgentExecution, AIProvider, SecretsStorage } from "../schemas/config/index.js";
import type { LensId } from "../schemas/review/index.js";

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
  secretsStorage: SecretsStorage | null;
  provider: AIProvider | null;
  apiKey: string;
  inputMethod: InputMethod;
  model: string | null;
  defaultLenses: LensId[];
  agentExecution: AgentExecution;
}
