import { CatalogSelectableModelIdSchema } from "../catalog/schema.js";
import { isModelIdAllowedForProduct, PRODUCT_REGISTRY } from "../providers/product-registry.js";
import {
  HostedApiConfigurationInputSchema,
  HostedApiTransportInputSchema,
  WriteOnlySecretInputSchema,
} from "../schemas/config/index.js";
import type { OnboardingDraft } from "./defaults.js";
import { getPlanNotice, type RunnableSetupStep } from "./setup-plan.js";
import { OnboardingAcknowledgementSchema } from "./types.js";

function hasCurrentProduct(data: OnboardingDraft): boolean {
  const { configurationInput, plan } = data;
  return (
    plan.productId === configurationInput.productId &&
    plan.transportFamily === configurationInput.transportFamily
  );
}

function hasEndpointBinding(data: OnboardingDraft): boolean {
  const { configurationInput } = data;
  const { credential: _credential, ...endpointInput } = configurationInput;
  if (!HostedApiTransportInputSchema.safeParse(endpointInput).success) return false;

  return PRODUCT_REGISTRY[configurationInput.productId].configuration.endpoints.some(
    (candidate) => candidate.endpoint === configurationInput.endpoint,
  );
}

function hasAuthentication(data: OnboardingDraft): boolean {
  const { configurationInput } = data;
  if (!HostedApiConfigurationInputSchema.safeParse(configurationInput).success) return false;
  return WriteOnlySecretInputSchema.safeParse(configurationInput.credential).success;
}

function hasConfiguredTransport(data: OnboardingDraft): boolean {
  return hasEndpointBinding(data) && hasAuthentication(data);
}

function hasExactModel(data: OnboardingDraft): boolean {
  const modelId = data.selectedModelId;
  if (!modelId) return false;
  if (!CatalogSelectableModelIdSchema.safeParse(modelId).success) return false;
  return isModelIdAllowedForProduct(data.plan.productId, modelId);
}

function hasAcceptedNotice(data: OnboardingDraft): boolean {
  if (!hasConfiguredTransport(data) || !hasExactModel(data)) return false;
  if (!OnboardingAcknowledgementSchema.safeParse(data.acknowledgement).success) return false;
  if (data.acknowledgement.status !== "accepted") return false;

  const notice = getPlanNotice(data.plan);
  return (
    data.acknowledgement.noticeId === notice.id &&
    data.acknowledgement.noticeVersion === notice.noticeVersion
  );
}

export function canProceed(step: RunnableSetupStep["id"], data: OnboardingDraft): boolean {
  if (!hasCurrentProduct(data)) return false;
  if (!data.plan.steps.some((candidate) => candidate.id === step)) return false;

  switch (step) {
    case "product":
      return true;
    case "endpoint-binding":
      return hasEndpointBinding(data);
    case "authentication":
      return hasConfiguredTransport(data);
    case "model":
      return hasConfiguredTransport(data) && hasExactModel(data);
    case "acknowledgement":
      return hasAcceptedNotice(data);
  }
}
