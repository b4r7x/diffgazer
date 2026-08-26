import { PRODUCT_REGISTRY, SELECTABLE_PRODUCT_IDS } from "../providers/product-registry.js";
import type {
  AgentExecution,
  HostedApiConfigurationInput,
  RunnableProductId,
} from "../schemas/config/index.js";
import { HostedApiEndpointSchema } from "../schemas/config/index.js";
import { SELECTABLE_LENS_IDS, type SelectableLensId } from "../schemas/review/index.js";
import { buildSetupPlan, type RunnableSetupPlan } from "./setup-plan.js";
import type { OnboardingAcknowledgement } from "./types.js";

export type OnboardingConfigurationDraft = HostedApiConfigurationInput;

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
  const endpoint = firstEndpoint(productId);
  return {
    transportFamily: "hosted-api",
    productId,
    endpoint: HostedApiEndpointSchema.parse(endpoint.endpoint),
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
