import {
  PROVIDER_ENV_VARS,
  type SaveConfigRequest,
  type SettingsConfig,
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
  const apiKey =
    data.inputMethod === "env"
      ? { kind: "env" as const, varName: PROVIDER_ENV_VARS[data.provider] }
      : { kind: "literal" as const, value: data.apiKey };
  return {
    provider: data.provider,
    apiKey,
    model: data.model ?? undefined,
  };
}

export interface SaveWizardCallbacks {
  saveSettings: (payload: SettingsPayload) => Promise<unknown>;
  saveConfig: (payload: SaveConfigRequest) => Promise<unknown>;
}

export type SaveWizardResult =
  | { status: "complete" }
  | { status: "partial"; completedSteps: ("settings" | "config")[]; error: unknown };

export async function saveWizard(
  data: WizardData,
  { saveSettings, saveConfig }: SaveWizardCallbacks,
): Promise<SaveWizardResult> {
  const completedSteps: ("settings" | "config")[] = [];

  try {
    await saveSettings(buildSettingsPayload(data));
    completedSteps.push("settings");
  } catch (error) {
    return { status: "partial", completedSteps, error };
  }

  try {
    await saveConfig(buildConfigPayload(data));
    completedSteps.push("config");
  } catch (error) {
    return { status: "partial", completedSteps, error };
  }

  return { status: "complete" };
}
