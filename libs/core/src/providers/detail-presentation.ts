import type { RunnableProductId } from "../schemas/config/transports.js";
import { requiresExplicitModelSelection } from "./product-registry.js";

export const PROVIDER_DETAIL_ACTION_LABELS = {
  selectProvider: "Select Provider",
  configureApiKey: "Configure API Key",
  removeKey: "Remove Key",
  selectModel: "Select Model",
} as const;

export const PROVIDER_DETAIL_EMPTY_LABEL = "Select a provider to view details";

export function getProviderDetailModelLabel(
  productId: RunnableProductId,
  model: string | undefined,
  defaultModel: string | undefined,
): string {
  if (model) return model;
  if (requiresExplicitModelSelection(productId)) return "Model required";
  if (defaultModel) return `${defaultModel} (default)`;
  return "No default model";
}
