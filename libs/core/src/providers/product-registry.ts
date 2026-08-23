import {
  type HostedApiProductId,
  type LocalCliProductId,
  type LocalHttpProductId,
  RUNNABLE_PRODUCT_IDS,
  type RunnableProductId,
} from "../schemas/config/product-ids.js";
import type { ReadinessAcknowledgement } from "../schemas/config/readiness.js";
import type {
  AdmissionCheck,
  BillingMode,
  ConfigurationField,
  ModelPolicy,
} from "./model-policy.js";
import { matchesModelPolicy } from "./model-policy.js";
import type { EndpointProfile } from "./product-endpoints.js";
import { PRODUCT_ENDPOINT_TUPLES } from "./product-endpoints.js";

export interface ProductNotice {
  readonly id: string;
  readonly noticeVersion: number;
  readonly acknowledgement: "required";
  readonly acknowledgeBefore: "first-context-send";
  readonly renewAcknowledgementOn: "material-notice-change";
  readonly billing: readonly string[];
  readonly privacy: readonly string[];
}

/** The acknowledgement a surface records when a product notice is accepted. */
export function acceptNotice(
  notice: ProductNotice,
  acceptedAt = new Date().toISOString(),
): Extract<ReadinessAcknowledgement, { status: "accepted" }> {
  return {
    status: "accepted",
    noticeId: notice.id,
    noticeVersion: notice.noticeVersion,
    acceptedAt,
  };
}

export interface ProductAdmissionPolicy {
  readonly requiredChecks: readonly AdmissionCheck[];
  readonly structuredOutput:
    | "strict-json-schema"
    | "json-object-local-validation"
    | "pinned-cli-terminal-schema";
  readonly usage: "required-terminal" | "optional";
}

type ProductTransportFamily<ProductId extends RunnableProductId> =
  ProductId extends HostedApiProductId
    ? "hosted-api"
    : ProductId extends LocalHttpProductId
      ? "local-http"
      : ProductId extends LocalCliProductId
        ? "local-cli"
        : never;

export interface RunnableProductDescriptor<ProductId extends RunnableProductId> {
  readonly id: ProductId;
  readonly kind: "runnable";
  readonly selectable: true;
  readonly transportFamily: ProductTransportFamily<ProductId>;
  readonly presentation: {
    readonly name: string;
    readonly description: string;
    readonly setupLabel: string;
  };
  readonly configuration: {
    readonly credentialKind:
      | "hosted-api-key-reference"
      | "none-or-optional-local-bearer"
      | "vendor-managed-local-auth";
    readonly fields: readonly ConfigurationField[];
    readonly endpoints: readonly EndpointProfile[];
    readonly customLoopbackEndpoint?: true;
  };
  readonly modelPolicy: ModelPolicy;
  readonly admission: ProductAdmissionPolicy;
  readonly billing: {
    readonly modes: readonly BillingMode[];
    readonly posture: string;
  };
  readonly notice: ProductNotice;
}

export type ProductRegistry = {
  readonly [ProductId in RunnableProductId]: RunnableProductDescriptor<ProductId>;
};

const HOSTED_CHECKS = [
  "credential",
  "endpoint",
  "model-discovery",
  "structured-output",
  "usage",
  "acknowledgement",
] as const satisfies readonly AdmissionCheck[];

const LOCAL_HTTP_CHECKS = [
  "endpoint",
  "loopback",
  "model-discovery",
  "server-version",
  "structured-output",
  "cancellation",
  "acknowledgement",
] as const satisfies readonly AdmissionCheck[];

const LOCAL_CLI_CHECKS = [
  "installation",
  "runtime-version",
  "account-plan",
  "model-discovery",
  "negative-capabilities",
  "structured-output",
  "cancellation",
  "acknowledgement",
] as const satisfies readonly AdmissionCheck[];

/**
 * Every runnable product is selectable: `ProductRegistry` maps over the whole
 * `RunnableProductId` union and every descriptor is `selectable: true`. Deriving
 * the picker order from the runnable tuple keeps one identity authority instead
 * of a second hand-maintained id list.
 */
export const SELECTABLE_PRODUCT_IDS = RUNNABLE_PRODUCT_IDS;

export const PRODUCT_REGISTRY = {
  gemini: {
    id: "gemini",
    kind: "runnable",
    selectable: true,
    transportFamily: "hosted-api",
    presentation: {
      name: "Google Gemini",
      description: "Google's hosted Gemini API with configuration-bound model discovery.",
      setupLabel: "Configure Google Gemini",
    },
    configuration: {
      credentialKind: "hosted-api-key-reference",
      fields: ["credential"],
      endpoints: PRODUCT_ENDPOINT_TUPLES.gemini,
    },
    modelPolicy: {
      kind: "discovered-exact",
      suggestedModelId: "gemini-2.5-flash",
      aliases: "forbidden",
    },
    admission: {
      requiredChecks: HOSTED_CHECKS,
      structuredOutput: "strict-json-schema",
      usage: "optional",
    },
    billing: {
      modes: ["free-tier", "pay-as-you-go"],
      posture: "Availability, quota, and pricing are live account and model observations.",
    },
    notice: {
      id: "gemini-hosted-api",
      noticeVersion: 1,
      acknowledgement: "required",
      acknowledgeBefore: "first-context-send",
      renewAcknowledgementOn: "material-notice-change",
      billing: ["Free and paid availability depends on the selected account and exact model."],
      privacy: ["Data handling follows the configured Google API product and account terms."],
    },
  },
  zai: {
    id: "zai",
    kind: "runnable",
    selectable: true,
    transportFamily: "hosted-api",
    presentation: {
      name: "Z.AI",
      description: "General Z.AI Open Platform pay-as-you-go API.",
      setupLabel: "Configure Z.AI PAYG",
    },
    configuration: {
      credentialKind: "hosted-api-key-reference",
      fields: ["credential"],
      endpoints: PRODUCT_ENDPOINT_TUPLES.zai,
    },
    modelPolicy: {
      kind: "discovered-exact",
      suggestedModelId: "glm-5-turbo",
      aliases: "forbidden",
    },
    admission: {
      requiredChecks: HOSTED_CHECKS,
      structuredOutput: "json-object-local-validation",
      usage: "optional",
    },
    billing: {
      modes: ["pay-as-you-go"],
      posture: "General Open Platform pay-as-you-go only.",
    },
    notice: {
      id: "zai-general-payg",
      noticeVersion: 1,
      acknowledgement: "required",
      acknowledgeBefore: "first-context-send",
      renewAcknowledgementOn: "material-notice-change",
      billing: ["This configuration uses general Open Platform pay-as-you-go billing."],
      privacy: [
        "API no-training and data-handling claims apply only to the exact general PAYG route.",
      ],
    },
  },
  openrouter: {
    id: "openrouter",
    kind: "runnable",
    selectable: true,
    transportFamily: "hosted-api",
    presentation: {
      name: "OpenRouter",
      description: "A hosted aggregator using one pinned downstream route per selection.",
      setupLabel: "Configure OpenRouter",
    },
    configuration: {
      credentialKind: "hosted-api-key-reference",
      fields: ["credential"],
      endpoints: PRODUCT_ENDPOINT_TUPLES.openrouter,
    },
    modelPolicy: {
      kind: "pinned-downstream-route",
      routePolicy: "pinned",
      automaticRouting: "forbidden",
      aliases: "forbidden",
    },
    admission: {
      requiredChecks: [...HOSTED_CHECKS, "downstream-route"],
      structuredOutput: "strict-json-schema",
      usage: "optional",
    },
    billing: {
      modes: ["route-specific"],
      posture: "Price, credit, and quota belong to the pinned downstream route.",
    },
    notice: {
      id: "openrouter-pinned-route",
      noticeVersion: 1,
      acknowledgement: "required",
      acknowledgeBefore: "first-context-send",
      renewAcknowledgementOn: "material-notice-change",
      billing: ["Billing and availability are disclosed for the exact pinned downstream route."],
      privacy: [
        "Provider, region, license, and retention facts come from the pinned route, not the aggregator brand.",
      ],
    },
  },
  groq: {
    id: "groq",
    kind: "runnable",
    selectable: true,
    transportFamily: "hosted-api",
    presentation: {
      name: "Groq",
      description: "Groq's hosted API with exact discovered model admission.",
      setupLabel: "Configure Groq",
    },
    configuration: {
      credentialKind: "hosted-api-key-reference",
      fields: ["credential"],
      endpoints: PRODUCT_ENDPOINT_TUPLES.groq,
    },
    modelPolicy: {
      kind: "discovered-exact",
      suggestedModelId: "openai/gpt-oss-120b",
      aliases: "forbidden",
    },
    admission: {
      requiredChecks: HOSTED_CHECKS,
      structuredOutput: "strict-json-schema",
      usage: "optional",
    },
    billing: {
      modes: ["free-tier", "pay-as-you-go"],
      posture: "Quota, availability, and pricing are checked observations, not guarantees.",
    },
    notice: {
      id: "groq-hosted-api",
      noticeVersion: 1,
      acknowledgement: "required",
      acknowledgeBefore: "first-context-send",
      renewAcknowledgementOn: "material-notice-change",
      billing: ["Current account and model limits are verified during setup."],
      privacy: ["Data handling follows the selected Groq API account and model terms."],
    },
  },
  cerebras: {
    id: "cerebras",
    kind: "runnable",
    selectable: true,
    transportFamily: "hosted-api",
    presentation: {
      name: "Cerebras",
      description: "Cerebras hosted inference with exact discovered model admission.",
      setupLabel: "Configure Cerebras",
    },
    configuration: {
      credentialKind: "hosted-api-key-reference",
      fields: ["credential"],
      endpoints: PRODUCT_ENDPOINT_TUPLES.cerebras,
    },
    modelPolicy: {
      kind: "discovered-exact",
      suggestedModelId: "gpt-oss-120b",
      aliases: "forbidden",
    },
    admission: {
      requiredChecks: HOSTED_CHECKS,
      structuredOutput: "strict-json-schema",
      usage: "optional",
    },
    billing: {
      modes: ["pay-as-you-go"],
      posture: "Quota, availability, and pricing are checked observations, not guarantees.",
    },
    notice: {
      id: "cerebras-hosted-api",
      noticeVersion: 1,
      acknowledgement: "required",
      acknowledgeBefore: "first-context-send",
      renewAcknowledgementOn: "material-notice-change",
      billing: ["Current account and model limits are verified during setup."],
      privacy: ["Data handling follows the selected Cerebras API account and model terms."],
    },
  },
  deepseek: {
    id: "deepseek",
    kind: "runnable",
    selectable: true,
    transportFamily: "hosted-api",
    presentation: {
      name: "DeepSeek",
      description: "DeepSeek Open Platform pay-as-you-go API.",
      setupLabel: "Configure DeepSeek PAYG",
    },
    configuration: {
      credentialKind: "hosted-api-key-reference",
      fields: ["credential"],
      endpoints: PRODUCT_ENDPOINT_TUPLES.deepseek,
    },
    modelPolicy: {
      kind: "discovered-allowlist",
      modelIds: ["deepseek-v4-flash", "deepseek-v4-pro"],
      suggestedModelId: "deepseek-v4-flash",
      higherCostModelIds: ["deepseek-v4-pro"],
      aliases: "forbidden",
    },
    admission: {
      requiredChecks: HOSTED_CHECKS,
      structuredOutput: "json-object-local-validation",
      usage: "required-terminal",
    },
    billing: {
      modes: ["pay-as-you-go"],
      posture: "PAYG pricing and limits are live observations; no free quota is promised.",
    },
    notice: {
      id: "deepseek-payg-prc",
      noticeVersion: 1,
      acknowledgement: "required",
      acknowledgeBefore: "first-context-send",
      renewAcknowledgementOn: "material-notice-change",
      billing: ["This is opt-in pay-as-you-go usage with account-specific limits."],
      privacy: [
        "Inputs and outputs may be processed and stored in the PRC.",
        "Retention duration is uncertain and the service-improvement setting provides an opt-out.",
        "DeepSeek is not presented as zero retention.",
      ],
    },
  },
  qwen: {
    id: "qwen",
    kind: "runnable",
    selectable: true,
    transportFamily: "hosted-api",
    presentation: {
      name: "Qwen International",
      description: "Alibaba Model Studio international pay-as-you-go API.",
      setupLabel: "Configure Qwen International PAYG",
    },
    configuration: {
      credentialKind: "hosted-api-key-reference",
      fields: ["credential", "region", "workspace"],
      endpoints: PRODUCT_ENDPOINT_TUPLES.qwen,
    },
    modelPolicy: {
      kind: "discovered-allowlist",
      modelIds: ["qwen3-coder-flash", "qwen3-coder-plus"],
      suggestedModelId: "qwen3-coder-flash",
      higherCostModelIds: ["qwen3-coder-plus"],
      higherCostModelEvidence: {
        outputLimit: "required",
        reviewConformance: "required",
      },
      aliases: "forbidden",
    },
    admission: {
      requiredChecks: [...HOSTED_CHECKS, "region", "workspace"],
      structuredOutput: "json-object-local-validation",
      usage: "required-terminal",
    },
    billing: {
      modes: ["pay-as-you-go"],
      posture: "International PAYG only; no international free quota is promised.",
    },
    notice: {
      id: "qwen-international-payg",
      noticeVersion: 1,
      acknowledgement: "required",
      acknowledgeBefore: "first-context-send",
      renewAcknowledgementOn: "material-notice-change",
      billing: [
        "The selected international region and workspace determine billing and availability.",
        "No international free quota is promised.",
        "Subscription plan credentials are excluded.",
      ],
      privacy: [
        "The selected international region and workspace are bound to the configuration.",
        "Provider material permits retention where required by law and gives no fixed retention period.",
      ],
    },
  },
  moonshot: {
    id: "moonshot",
    kind: "runnable",
    selectable: true,
    transportFamily: "hosted-api",
    presentation: {
      name: "Moonshot Open Platform",
      description: "Moonshot/Kimi Open Platform pay-as-you-go API with isolated regions.",
      setupLabel: "Configure Moonshot PAYG",
    },
    configuration: {
      credentialKind: "hosted-api-key-reference",
      fields: ["credential", "region"],
      endpoints: PRODUCT_ENDPOINT_TUPLES.moonshot,
    },
    modelPolicy: {
      kind: "discovered-family",
      familyPrefixes: ["kimi-k3", "kimi-k2.6"],
      rejectedAliases: ["kimi-latest", "latest"],
      aliases: "forbidden",
    },
    admission: {
      requiredChecks: [...HOSTED_CHECKS, "region"],
      structuredOutput: "strict-json-schema",
      usage: "required-terminal",
    },
    billing: {
      modes: ["pay-as-you-go"],
      posture: "Balance, price, and limits belong to the selected regional PAYG account.",
    },
    notice: {
      id: "moonshot-open-platform-payg",
      noticeVersion: 1,
      acknowledgement: "required",
      acknowledgeBefore: "first-context-send",
      renewAcknowledgementOn: "material-notice-change",
      billing: ["Mainland and international accounts, balances, and endpoints are isolated."],
      privacy: [
        "API no-training claims apply only to the selected Open Platform PAYG route.",
        "Consumer and Kimi Code products have different terms and are not substituted.",
      ],
    },
  },
  mistral: {
    id: "mistral",
    kind: "runnable",
    selectable: true,
    transportFamily: "hosted-api",
    presentation: {
      name: "Mistral",
      description: "Mistral hosted API with explicit global or EU endpoint selection.",
      setupLabel: "Configure Mistral",
    },
    configuration: {
      credentialKind: "hosted-api-key-reference",
      fields: ["credential", "region"],
      endpoints: PRODUCT_ENDPOINT_TUPLES.mistral,
    },
    modelPolicy: {
      kind: "discovered-exact",
      suggestedModelId: "mistral-medium-2604",
      aliases: "forbidden",
    },
    admission: {
      requiredChecks: [...HOSTED_CHECKS, "region"],
      structuredOutput: "strict-json-schema",
      usage: "optional",
    },
    billing: {
      modes: ["evaluation", "pay-as-you-go"],
      posture: "Free use is evaluation/prototyping with volatile account limits.",
    },
    notice: {
      id: "mistral-regional-api",
      noticeVersion: 1,
      acknowledgement: "required",
      acknowledgeBefore: "first-context-send",
      renewAcknowledgementOn: "material-notice-change",
      billing: [
        "The selected global or EU endpoint and account determine price and limits.",
        "Free mode is evaluation/prototyping, not unlimited production capacity.",
      ],
      privacy: [
        "Submitted data may be used for training unless the account opts out.",
        "API inputs and outputs normally have rolling 30-day retention.",
        "Zero data retention requires an eligible approved arrangement and is never inferred.",
      ],
    },
  },
  "ollama-cloud": {
    id: "ollama-cloud",
    kind: "runnable",
    selectable: true,
    transportFamily: "hosted-api",
    presentation: {
      name: "Ollama Cloud",
      description: "Ollama's hosted models behind the ollama.com OpenAI-compatible API.",
      setupLabel: "Configure Ollama Cloud",
    },
    configuration: {
      credentialKind: "hosted-api-key-reference",
      fields: ["credential"],
      endpoints: PRODUCT_ENDPOINT_TUPLES["ollama-cloud"],
    },
    modelPolicy: {
      kind: "discovered-exact",
      suggestedModelId: "gpt-oss:20b",
      aliases: "forbidden",
    },
    admission: {
      requiredChecks: HOSTED_CHECKS,
      structuredOutput: "json-object-local-validation",
      usage: "optional",
    },
    billing: {
      modes: ["free-tier", "subscription-credit"],
      posture:
        "Usage draws on the account's plan quota (Free, Pro, or Max) in session and weekly windows; no per-token price is published.",
    },
    notice: {
      id: "ollama-cloud-hosted-api",
      noticeVersion: 1,
      acknowledgement: "required",
      acknowledgeBefore: "first-context-send",
      renewAcknowledgementOn: "material-notice-change",
      billing: [
        "Usage counts against the account's Ollama plan quota (Free, Pro, or Max) in 5-hour session and 7-day weekly windows; no per-token price is published.",
      ],
      privacy: [
        "Ollama states that cloud prompts and responses are not logged, stored, or trained on.",
        "Repository content is sent to ollama.com; this is not the loopback Ollama transport.",
      ],
    },
  },
  ollama: {
    id: "ollama",
    kind: "runnable",
    selectable: true,
    transportFamily: "local-http",
    presentation: {
      name: "Ollama",
      description: "An Ollama runtime reached through a verified loopback first hop.",
      setupLabel: "Configure local Ollama",
    },
    configuration: {
      credentialKind: "none-or-optional-local-bearer",
      fields: ["endpoint", "local-authentication"],
      endpoints: PRODUCT_ENDPOINT_TUPLES.ollama,
      customLoopbackEndpoint: true,
    },
    modelPolicy: { kind: "discovered-exact", aliases: "forbidden" },
    admission: {
      requiredChecks: LOCAL_HTTP_CHECKS,
      structuredOutput: "strict-json-schema",
      usage: "optional",
    },
    billing: {
      modes: ["local-resource"],
      posture: "Operation uses local hardware and may still incur hardware or operating costs.",
    },
    notice: {
      id: "ollama-loopback",
      noticeVersion: 1,
      acknowledgement: "required",
      acknowledgeBefore: "first-context-send",
      renewAcknowledgementOn: "material-notice-change",
      billing: ["No zero-cost or adequate-hardware claim is inferred from local operation."],
      privacy: [
        "Diffgazer verifies only that the first network hop is loopback.",
        "Any downstream routing, data residency, storage, or telemetry is the selected server operator's responsibility.",
        "Ollama Cloud is not this transport; the separate Ollama Cloud product reaches ollama.com.",
      ],
    },
  },
  "local-openai": {
    id: "local-openai",
    kind: "runnable",
    selectable: true,
    transportFamily: "local-http",
    presentation: {
      name: "Local OpenAI-compatible",
      description: "One provider reached through a verified loopback first hop.",
      setupLabel: "Configure local OpenAI-compatible server",
    },
    configuration: {
      credentialKind: "none-or-optional-local-bearer",
      fields: ["endpoint", "local-authentication"],
      endpoints: PRODUCT_ENDPOINT_TUPLES["local-openai"],
      customLoopbackEndpoint: true,
    },
    modelPolicy: { kind: "discovered-exact", aliases: "forbidden" },
    admission: {
      requiredChecks: LOCAL_HTTP_CHECKS,
      structuredOutput: "strict-json-schema",
      usage: "optional",
    },
    billing: {
      modes: ["local-resource"],
      posture: "Operation uses local hardware and may still incur hardware or operating costs.",
    },
    notice: {
      id: "local-openai-loopback",
      noticeVersion: 1,
      acknowledgement: "required",
      acknowledgeBefore: "first-context-send",
      renewAcknowledgementOn: "material-notice-change",
      billing: ["No zero-cost or adequate-hardware claim is inferred from local operation."],
      privacy: [
        "Diffgazer verifies only that the first network hop is loopback.",
        "Any downstream routing, data residency, storage, or telemetry is the selected server operator's responsibility.",
      ],
    },
  },
  "codex-cli": {
    id: "codex-cli",
    kind: "runnable",
    selectable: true,
    transportFamily: "local-cli",
    presentation: {
      name: "OpenAI Codex CLI",
      description:
        "A user-owned Codex CLI installation with vendor-managed local auth; support requires matching exact compatibility evidence.",
      setupLabel: "Configure Codex CLI",
    },
    configuration: {
      credentialKind: "vendor-managed-local-auth",
      fields: ["installation"],
      endpoints: PRODUCT_ENDPOINT_TUPLES["codex-cli"],
    },
    modelPolicy: { kind: "discovered-exact", aliases: "forbidden" },
    admission: {
      requiredChecks: LOCAL_CLI_CHECKS,
      structuredOutput: "pinned-cli-terminal-schema",
      usage: "optional",
    },
    billing: {
      modes: ["subscription-credit", "pay-as-you-go"],
      posture: "The active auth and plan class determine subscription-credit or API billing.",
    },
    notice: {
      id: "codex-cli-account",
      noticeVersion: 1,
      acknowledgement: "required",
      acknowledgeBefore: "first-context-send",
      renewAcknowledgementOn: "material-notice-change",
      billing: [
        "The active account and plan class determine credits, rate limits, or API billing.",
      ],
      privacy: [
        "Consumer and business/API data handling differ and must match the active account posture.",
        "Diffgazer uses existing vendor-managed local auth and does not import or proxy credentials.",
      ],
    },
  },
  "copilot-cli": {
    id: "copilot-cli",
    kind: "runnable",
    selectable: true,
    transportFamily: "local-cli",
    presentation: {
      name: "GitHub Copilot CLI",
      description:
        "A user-owned Copilot CLI installation with vendor-managed local auth; support requires matching exact compatibility evidence.",
      setupLabel: "Configure Copilot CLI",
    },
    configuration: {
      credentialKind: "vendor-managed-local-auth",
      fields: ["installation"],
      endpoints: PRODUCT_ENDPOINT_TUPLES["copilot-cli"],
    },
    modelPolicy: { kind: "discovered-exact", aliases: "forbidden" },
    admission: {
      requiredChecks: LOCAL_CLI_CHECKS,
      structuredOutput: "pinned-cli-terminal-schema",
      usage: "optional",
    },
    billing: {
      modes: ["subscription-credit"],
      posture: "The active Copilot plan and policy determine model access, credits, and limits.",
    },
    notice: {
      id: "copilot-cli-account",
      noticeVersion: 1,
      acknowledgement: "required",
      acknowledgeBefore: "first-context-send",
      renewAcknowledgementOn: "material-notice-change",
      billing: [
        "The active plan and policy determine model entitlement, credits, and rate limits.",
      ],
      privacy: [
        "Individual and business/enterprise data protections differ and must match the active plan.",
        "Diffgazer uses existing vendor-managed local auth and does not import or proxy credentials.",
      ],
    },
  },
} as const satisfies ProductRegistry;
export function isModelIdAllowedForProduct(productId: RunnableProductId, modelId: string): boolean {
  return matchesModelPolicy(modelId, PRODUCT_REGISTRY[productId].modelPolicy);
}

/**
 * A pinned-downstream-route product has no meaningful default: the exact route
 * is the identity, so presentation must ask for an explicit selection instead of
 * naming a fallback model.
 */
export function requiresExplicitModelSelection(productId: RunnableProductId): boolean {
  return PRODUCT_REGISTRY[productId].modelPolicy.kind === "pinned-downstream-route";
}
