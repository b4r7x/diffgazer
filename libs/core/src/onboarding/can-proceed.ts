import { CatalogSelectableModelIdSchema } from "../catalog/schema.js";
import { isModelIdAllowedForProduct, PRODUCT_REGISTRY } from "../providers/product-registry.js";
import {
  HostedApiConfigurationInputSchema,
  LocalCliConfigurationInputSchema,
  LocalHttpConfigurationInputSchema,
  WriteOnlySecretInputSchema,
} from "../schemas/config/index.js";
import type { OnboardingDraft } from "./defaults.js";
import type { RunnableSetupStep } from "./setup-plan.js";
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

  if (configurationInput.transportFamily === "local-cli") return true;
  if (configurationInput.transportFamily === "local-http") {
    return LocalHttpConfigurationInputSchema.safeParse(configurationInput).success;
  }
  if (!HostedApiConfigurationInputSchema.safeParse(configurationInput).success) return false;

  const endpoint = PRODUCT_REGISTRY[configurationInput.productId].configuration.endpoints.find(
    (candidate) => candidate.endpoint === configurationInput.endpoint,
  );
  if (!endpoint) return false;
  if (("region" in endpoint ? endpoint.region : undefined) !== configurationInput.region) {
    return false;
  }
  return "workspaceBound" in endpoint && endpoint.workspaceBound
    ? configurationInput.workspace !== undefined
    : configurationInput.workspace === undefined;
}

function hasAuthentication(data: OnboardingDraft): boolean {
  const { configurationInput } = data;

  if (configurationInput.transportFamily === "hosted-api") {
    if (!HostedApiConfigurationInputSchema.safeParse(configurationInput).success) return false;
    return WriteOnlySecretInputSchema.safeParse(configurationInput.credential).success;
  }
  if (configurationInput.transportFamily === "local-cli") {
    return LocalCliConfigurationInputSchema.safeParse(configurationInput).success;
  }
  if (!LocalHttpConfigurationInputSchema.safeParse(configurationInput).success) return false;
  if (configurationInput.authentication === "none")
    return configurationInput.bearerToken === undefined;
  return WriteOnlySecretInputSchema.safeParse(configurationInput.bearerToken).success;
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

function hasPassedConformance(data: OnboardingDraft): boolean {
  return hasConfiguredTransport(data) && hasExactModel(data) && data.conformanceStatus === "passed";
}

function hasAcceptedNotice(data: OnboardingDraft): boolean {
  if (!hasPassedConformance(data)) return false;
  if (!OnboardingAcknowledgementSchema.safeParse(data.acknowledgement).success) return false;
  if (data.acknowledgement.status !== "accepted") return false;

  const notice = PRODUCT_REGISTRY[data.plan.productId].notice;
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
    case "conformance":
      return hasPassedConformance(data);
    case "acknowledgement":
      return hasAcceptedNotice(data);
  }
}
