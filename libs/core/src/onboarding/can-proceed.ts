import { CatalogSelectableModelIdSchema } from "../catalog/schema.js";
import {
  isPinnedDownstreamRouteModelId,
  type ModelPolicy,
  PRODUCT_REGISTRY,
} from "../providers/product-registry.js";
import {
  HostedApiConfigurationInputSchema,
  LocalCliConfigurationInputSchema,
  LocalHttpConfigurationInputSchema,
  WriteOnlySecretInputSchema,
} from "../schemas/config/index.js";
import type { OnboardingDraft } from "./defaults.js";
import type { RunnableSetupStep } from "./setup-plan.js";
import { OnboardingAcknowledgementSchema } from "./types.js";

function matchesPinnedDownstreamRoute(modelId: string): boolean {
  return isPinnedDownstreamRouteModelId(modelId);
}

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

function matchesModelPolicy(modelId: string, policy: ModelPolicy): boolean {
  if (!CatalogSelectableModelIdSchema.safeParse(modelId).success) return false;

  if (policy.kind === "discovered-allowlist") return policy.modelIds.includes(modelId);
  if (policy.kind === "discovered-family") {
    return (
      !policy.rejectedAliases.includes(modelId) &&
      policy.familyPrefixes.some((prefix) => modelId === prefix || modelId.startsWith(`${prefix}-`))
    );
  }
  if (policy.kind === "pinned-downstream-route") return matchesPinnedDownstreamRoute(modelId);
  return true;
}

/**
 * Explicit model opt-in is deliberately not inferred from discovery, a passing
 * conformance probe, or the product notice acknowledgement.  The current V2
 * setup draft has no opt-in field, so a policy that requires one must remain
 * unsupported until that state is represented by the setup plan.
 */
function hasRequiredModelOptIn(modelId: string, policy: ModelPolicy): boolean {
  if (policy.kind !== "discovered-exact" || !policy.explicitOptInSuffixes?.length) return true;
  return !policy.explicitOptInSuffixes.some((suffix) => modelId.endsWith(suffix));
}

/**
 * The onboarding draft has no client-safe representation of the live evidence
 * required by a higher-cost model policy.  Keep those models unavailable until
 * the server can carry and verify that evidence instead of treating generic
 * conformance as sufficient.
 */
function hasRequiredHigherCostEvidence(modelId: string, policy: ModelPolicy): boolean {
  if (policy.kind !== "discovered-allowlist" || !policy.higherCostModelEvidence) return true;
  return !policy.higherCostModelIds?.includes(modelId);
}

function hasExactModel(data: OnboardingDraft): boolean {
  const modelId = data.selectedModelId;
  if (!modelId) return false;
  const policy = PRODUCT_REGISTRY[data.plan.productId].modelPolicy;
  return (
    matchesModelPolicy(modelId, policy) &&
    hasRequiredModelOptIn(modelId, policy) &&
    hasRequiredHigherCostEvidence(modelId, policy)
  );
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
