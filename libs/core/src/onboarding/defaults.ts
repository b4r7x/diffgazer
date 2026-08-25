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
import { SELECTABLE_LENS_IDS, type SelectableLensId } from "../schemas/review/index.js";
import { buildSetupPlan, type RunnableSetupPlan } from "./setup-plan.js";
import type { OnboardingAcknowledgement } from "./types.js";

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
  readonly acknowledgement: OnboardingAcknowledgement;
  readonly defaultLenses: readonly SelectableLensId[];
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
  if (!plan) throw new Error(`Missing runnable setup plan for ${productId}`);

  return {
    kind: "runnable",
    configurationInput: buildConfigurationDraft(productId),
    selectedModelId: null,
    acknowledgement: { status: "required" },
    defaultLenses: [...SELECTABLE_LENS_IDS],
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
