import { OPENROUTER_PROVIDER_ID } from "../schemas/config/index.js";

export const PROVIDER_DETAIL_ACTION_LABELS = {
  selectProvider: "Select Provider",
  configureApiKey: "Configure API Key",
  removeKey: "Remove Key",
  selectModel: "Select Model",
} as const;

export const PROVIDER_DETAIL_EMPTY_LABEL = "Select a provider to view details";

export function getProviderDetailModelLabel(
  providerId: string,
  model: string | undefined,
  defaultModel: string | undefined,
): string {
  if (model) return model;
  if (providerId === OPENROUTER_PROVIDER_ID) return "Model required";
  if (defaultModel) return `${defaultModel} (default)`;
  return "No default model";
}
