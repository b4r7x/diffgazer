import type {
  SaveConfigRequest,
  SettingsConfig,
} from "@diffgazer/core/schemas/config";
import type { WizardData } from "./types.js";

export type SettingsPayload = Pick<
  SettingsConfig,
  "secretsStorage" | "defaultLenses" | "agentExecution"
>;

export function buildSettingsPayload(data: WizardData): SettingsPayload {
  return {
    secretsStorage: data.secretsStorage,
    defaultLenses: data.defaultLenses,
    agentExecution: data.agentExecution,
  };
}

export function buildConfigPayload(data: WizardData): SaveConfigRequest {
  if (!data.provider) {
    throw new Error("Cannot build config payload without a provider");
  }
  return {
    provider: data.provider,
    apiKey: data.inputMethod === "env" ? "env" : data.apiKey,
    model: data.model ?? undefined,
  };
}

export interface SaveWizardCallbacks {
  saveSettings: (payload: SettingsPayload) => Promise<unknown>;
  saveConfig: (payload: SaveConfigRequest) => Promise<unknown>;
}

export async function saveWizard(
  data: WizardData,
  { saveSettings, saveConfig }: SaveWizardCallbacks,
): Promise<void> {
  await saveSettings(buildSettingsPayload(data));
  await saveConfig(buildConfigPayload(data));
}
