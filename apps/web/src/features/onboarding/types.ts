import type { AIProvider, SecretsStorage, AgentExecution } from "@diffgazer/schemas/config";
import type { LensId } from "@diffgazer/schemas/review";
import type { InputMethod } from "@/types/input-method";

export type OnboardingStep = "storage" | "provider" | "api-key" | "model" | "analysis";

export interface WizardData {
  secretsStorage: SecretsStorage;
  provider: AIProvider | null;
  apiKey: string;
  inputMethod: InputMethod;
  model: string | null;
  defaultLenses: LensId[];
  agentExecution: AgentExecution;
}
