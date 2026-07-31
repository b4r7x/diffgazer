import { PRODUCT_REGISTRY, SELECTABLE_PRODUCT_IDS } from "../providers/product-registry.js";
import type {
  AgentExecution,
  HostedApiConfigurationInput,
  LocalCliInstallationId,
  LocalCliProductId,
  LocalHttpConfigurationInput,
  RunnableProductId,
} from "../schemas/config/index.js";
import {
  HostedApiEndpointSchema,
  HostedApiProductIdSchema,
  LocalCliProductIdSchema,
  LocalHttpProductIdSchema,
  LocalOpenAIPresetIdSchema,
  LoopbackHttpEndpointSchema,
} from "../schemas/config/index.js";
import { LENS_IDS, type LensId } from "../schemas/review/index.js";
import { buildSetupPlan, type RunnableSetupPlan } from "./setup-plan.js";
import type { OnboardingAcknowledgement, OnboardingConformanceStatus } from "./types.js";

export interface LocalCliConfigurationDraft {
  readonly transportFamily: "local-cli";
  readonly productId: LocalCliProductId;
  readonly installationId?: LocalCliInstallationId;
}

export type OnboardingConfigurationDraft =
  | HostedApiConfigurationInput
  | LocalHttpConfigurationInput
  | LocalCliConfigurationDraft;

export interface OnboardingDraft {
  readonly kind: "runnable";
  readonly configurationInput: OnboardingConfigurationDraft;
  readonly selectedModelId: string | null;
  readonly conformanceStatus: OnboardingConformanceStatus;
  readonly acknowledgement: OnboardingAcknowledgement;
  readonly defaultLenses: readonly LensId[];
  readonly agentExecution: AgentExecution;
  readonly plan: RunnableSetupPlan;
}

function firstEndpoint(productId: RunnableProductId) {
  const endpoint = PRODUCT_REGISTRY[productId].configuration.endpoints[0];
  if (!endpoint) throw new Error(`Missing endpoint profile for ${productId}`);
  return endpoint;
}

function buildConfigurationDraft(productId: RunnableProductId): OnboardingConfigurationDraft {
  const product = PRODUCT_REGISTRY[productId];

  if (product.transportFamily === "hosted-api") {
    const endpoint = firstEndpoint(productId);
    return {
      transportFamily: "hosted-api",
      productId: HostedApiProductIdSchema.parse(productId),
      endpoint: HostedApiEndpointSchema.parse(endpoint.endpoint),
      ...("region" in endpoint ? { region: endpoint.region } : {}),
    };
  }

  if (product.transportFamily === "local-http") {
    const endpoint = firstEndpoint(productId);
    return {
      transportFamily: "local-http",
      productId: LocalHttpProductIdSchema.parse(productId),
      endpoint: LoopbackHttpEndpointSchema.parse(endpoint.endpoint),
      authentication: "none",
      ...(productId === "local-openai"
        ? { presetId: LocalOpenAIPresetIdSchema.parse(endpoint.id) }
        : {}),
    };
  }

  return {
    transportFamily: "local-cli",
    productId: LocalCliProductIdSchema.parse(productId),
  };
}

export function getInitialWizardData(
  productId: RunnableProductId = SELECTABLE_PRODUCT_IDS[0],
): OnboardingDraft {
  const plan = buildSetupPlan(productId);
  if (!plan || plan.kind !== "runnable") {
    throw new Error(`Missing runnable setup plan for ${productId}`);
  }

  return {
    kind: "runnable",
    configurationInput: buildConfigurationDraft(productId),
    selectedModelId: null,
    conformanceStatus: "not-tested",
    acknowledgement: { status: "required" },
    defaultLenses: [...LENS_IDS],
    agentExecution: "sequential",
    plan,
  };
}

export function resetWizardProduct(
  data: Pick<OnboardingDraft, "defaultLenses" | "agentExecution">,
  productId: RunnableProductId,
): OnboardingDraft {
  return {
    ...getInitialWizardData(productId),
    defaultLenses: [...data.defaultLenses],
    agentExecution: data.agentExecution,
  };
}
