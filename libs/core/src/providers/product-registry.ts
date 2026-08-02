import { REMOVED_PRODUCT_ID } from "../schemas/config/providers.js";
import type {
  CandidateProductId,
  HostedApiProductId,
  LocalCliProductId,
  LocalHttpProductId,
  RemovedProductId,
  RunnableProductId,
  TransportFamily,
} from "../schemas/config/transports.js";

/**
 * OpenRouter accepts routing selectors in the same model-id-shaped slot as a
 * downstream provider/model pair.  Those selectors are not immutable
 * execution identities and must be rejected at every model-policy boundary.
 * Keep the policy in the product registry so admission, client projection,
 * onboarding, and discovery cannot drift apart.
 */
const PINNED_DOWNSTREAM_ROUTE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/;
const PINNED_DOWNSTREAM_ROUTE_RESERVED_SEGMENTS = new Set([
  "auto",
  "automatic",
  "cheapest",
  "default",
  "exacto",
  "extended",
  "fallback",
  "fastest",
  "floor",
  "free",
  "nitro",
  "online",
  "openrouter",
  "random",
  "route",
  "thinking",
]);

/**
 * Returns true only for one exact downstream provider/model pair.  Reserved
 * selectors are compared by segment, so legitimate names that merely contain
 * a selector (for example, `automaticity/model`) remain valid.
 */
export function isPinnedDownstreamRouteModelId(modelId: string): boolean {
  if (!PINNED_DOWNSTREAM_ROUTE_PATTERN.test(modelId)) return false;

  const [downstreamProvider = "", downstreamModel = ""] = modelId.split("/");
  return ![downstreamProvider, downstreamModel].some((segment) =>
    PINNED_DOWNSTREAM_ROUTE_RESERVED_SEGMENTS.has(segment.toLowerCase()),
  );
}

export type BillingMode =
  | "free-tier"
  | "pay-as-you-go"
  | "evaluation"
  | "route-specific"
  | "local-resource"
  | "subscription-credit";

export type AdmissionCheck =
  | "credential"
  | "endpoint"
  | "region"
  | "workspace"
  | "model-discovery"
  | "downstream-route"
  | "structured-output"
  | "usage"
  | "loopback"
  | "server-version"
  | "installation"
  | "runtime-version"
  | "account-plan"
  | "negative-capabilities"
  | "cancellation"
  | "acknowledgement";

export type ConfigurationField =
  | "credential"
  | "region"
  | "workspace"
  | "endpoint"
  | "local-authentication"
  | "installation";

export interface EndpointProfile {
  readonly id: string;
  readonly label: string;
  readonly endpoint: string;
  readonly region?: string;
  readonly workspaceBound?: true;
}

type ProductEndpointTupleRegistry = {
  readonly [ProductId in RunnableProductId]: readonly EndpointProfile[];
};

export type ModelPolicy =
  | {
      readonly kind: "discovered-exact";
      readonly suggestedModelId?: string;
      readonly explicitOptInSuffixes?: readonly string[];
      readonly aliases: "forbidden";
    }
  | {
      readonly kind: "discovered-allowlist";
      readonly modelIds: readonly string[];
      readonly suggestedModelId?: string;
      readonly higherCostModelIds?: readonly string[];
      /**
       * Higher-cost choices may be presented only after the named live evidence
       * has been collected for the exact configured tuple.  This is a policy
       * marker for server admission; it deliberately carries no provider limit
       * value and is not client evidence.
       */
      readonly higherCostModelEvidence?: {
        readonly outputLimit: "required";
        readonly reviewConformance: "required";
      };
      readonly aliases: "forbidden";
    }
  | {
      readonly kind: "discovered-family";
      readonly familyPrefixes: readonly string[];
      readonly rejectedAliases: readonly string[];
      readonly aliases: "forbidden";
    }
  | {
      readonly kind: "pinned-downstream-route";
      readonly routePolicy: "pinned";
      readonly automaticRouting: "forbidden";
      readonly aliases: "forbidden";
    };

/**
 * The single model-policy predicate.  Every boundary that decides whether a
 * model id is admissible for a product — onboarding, client projection,
 * client-safe summaries, discovery mapping, and the execution tuple — must call
 * this so the interpretations cannot drift apart.
 *
 * It deliberately fails closed for the two policy shapes whose extra evidence
 * has no client-safe representation: an `explicitOptInSuffixes` model needs an
 * opt-in the V2 contracts do not carry, and a `higherCostModelIds` model needs
 * the named live output-limit and review-conformance observations, which are
 * server-only.  Neither may be inferred from discovery, conformance, or notice
 * acknowledgement.
 *
 * Model-id shape validation is deliberately left to the caller, because the
 * applicable shape schema differs per boundary.
 */
export function matchesModelPolicy(modelId: string, policy: ModelPolicy): boolean {
  switch (policy.kind) {
    case "discovered-exact":
      return !policy.explicitOptInSuffixes?.some((suffix) => modelId.endsWith(suffix));
    case "discovered-allowlist":
      if (!policy.modelIds.includes(modelId)) return false;
      return !(
        policy.higherCostModelEvidence !== undefined && policy.higherCostModelIds?.includes(modelId)
      );
    case "discovered-family":
      return (
        !policy.rejectedAliases.includes(modelId) &&
        policy.familyPrefixes.some(
          (prefix) => modelId === prefix || modelId.startsWith(`${prefix}-`),
        )
      );
    case "pinned-downstream-route":
      return isPinnedDownstreamRouteModelId(modelId);
  }
}

/** Applies {@link matchesModelPolicy} to the product's registered policy. */
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

export interface ProductNotice {
  readonly id: string;
  readonly noticeVersion: number;
  readonly acknowledgement: "required";
  readonly acknowledgeBefore: "first-context-send";
  readonly renewAcknowledgementOn: "material-notice-change";
  readonly billing: readonly string[];
  readonly privacy: readonly string[];
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
  readonly contractVersion: number;
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

export interface RemovedProductDescriptor<ProductId extends RemovedProductId> {
  readonly id: ProductId;
  readonly kind: "removed";
  readonly selectable: false;
  readonly decoderOnly: true;
  readonly transportFamily: TransportFamily;
  readonly presentation: {
    readonly name: string;
    readonly description: string;
  };
  readonly migration: {
    readonly targetProductId: "zai";
    readonly credentialHandling: "retain-until-explicit-delete-never-copy-test-or-send";
    readonly actions: readonly ["create-new-zai-configuration", "delete-removed-record"];
  };
}

export type ProductRegistry = {
  readonly [ProductId in RunnableProductId]: RunnableProductDescriptor<ProductId>;
} & {
  readonly [ProductId in RemovedProductId]: RemovedProductDescriptor<ProductId>;
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

export const PRODUCT_ENDPOINT_TUPLES = {
  gemini: [
    {
      id: "global",
      label: "Global",
      endpoint: "https://generativelanguage.googleapis.com/v1beta",
    },
  ],
  zai: [
    {
      id: "general-payg",
      label: "General Open Platform PAYG",
      endpoint: "https://api.z.ai/api/paas/v4",
    },
  ],
  openrouter: [{ id: "api", label: "OpenRouter API", endpoint: "https://openrouter.ai/api/v1" }],
  groq: [{ id: "global", label: "Global", endpoint: "https://api.groq.com/openai/v1" }],
  cerebras: [{ id: "global", label: "Global", endpoint: "https://api.cerebras.ai/v1" }],
  deepseek: [{ id: "payg", label: "Open Platform PAYG", endpoint: "https://api.deepseek.com/v1" }],
  qwen: [
    {
      id: "international",
      label: "International",
      endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
      region: "international",
      workspaceBound: true,
    },
  ],
  moonshot: [
    {
      id: "mainland",
      label: "Mainland China",
      endpoint: "https://api.moonshot.cn/v1",
      region: "mainland",
    },
    {
      id: "international",
      label: "International",
      endpoint: "https://api.moonshot.ai/v1",
      region: "international",
    },
  ],
  mistral: [
    {
      id: "global",
      label: "Global",
      endpoint: "https://api.mistral.ai/v1",
      region: "global",
    },
    {
      id: "eu",
      label: "European Union",
      endpoint: "https://api.eu.mistral.ai/v1",
      region: "eu",
    },
  ],
  ollama: [{ id: "default", label: "Default loopback", endpoint: "http://127.0.0.1:11434" }],
  "local-openai": [
    {
      id: "lm-studio",
      label: "LM Studio",
      endpoint: "http://127.0.0.1:1234/v1",
    },
    {
      id: "llama-cpp",
      label: "llama.cpp",
      endpoint: "http://127.0.0.1:8080/v1",
    },
  ],
  "codex-cli": [],
  "copilot-cli": [],
} as const satisfies ProductEndpointTupleRegistry;

export const SELECTABLE_PRODUCT_IDS = [
  "gemini",
  "zai",
  "openrouter",
  "groq",
  "cerebras",
  "deepseek",
  "qwen",
  "moonshot",
  "mistral",
  "ollama",
  "local-openai",
  "codex-cli",
  "copilot-cli",
] as const satisfies readonly RunnableProductId[];

export const PRODUCT_REGISTRY = {
  gemini: {
    id: "gemini",
    kind: "runnable",
    selectable: true,
    contractVersion: 1,
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
    contractVersion: 1,
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
      suggestedModelId: "glm-4.7",
      explicitOptInSuffixes: ["-flash"],
      aliases: "forbidden",
    },
    admission: {
      requiredChecks: HOSTED_CHECKS,
      structuredOutput: "json-object-local-validation",
      usage: "optional",
    },
    billing: {
      modes: ["pay-as-you-go"],
      posture: "General Open Platform PAYG only; Coding Plan quota is a different product.",
    },
    notice: {
      id: "zai-general-payg",
      noticeVersion: 1,
      acknowledgement: "required",
      acknowledgeBefore: "first-context-send",
      renewAcknowledgementOn: "material-notice-change",
      billing: ["This configuration uses general Open Platform PAYG, never Coding Plan quota."],
      privacy: [
        "API no-training and data-handling claims apply only to the exact general PAYG route.",
      ],
    },
  },
  openrouter: {
    id: "openrouter",
    kind: "runnable",
    selectable: true,
    contractVersion: 1,
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
    contractVersion: 1,
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
    contractVersion: 1,
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
      modes: ["free-tier", "pay-as-you-go"],
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
    contractVersion: 1,
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
    contractVersion: 1,
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
        "Coding Plan and Token Plan credentials are excluded.",
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
    contractVersion: 1,
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
    contractVersion: 1,
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
      kind: "discovered-allowlist",
      modelIds: ["mistral-small-2603"],
      suggestedModelId: "mistral-small-2603",
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
  ollama: {
    id: "ollama",
    kind: "runnable",
    selectable: true,
    contractVersion: 1,
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
        "Ollama Cloud is not this transport.",
      ],
    },
  },
  "local-openai": {
    id: "local-openai",
    kind: "runnable",
    selectable: true,
    contractVersion: 1,
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
    contractVersion: 1,
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
    contractVersion: 1,
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
  [REMOVED_PRODUCT_ID]: {
    id: REMOVED_PRODUCT_ID,
    kind: "removed",
    selectable: false,
    decoderOnly: true,
    transportFamily: "hosted-api",
    presentation: {
      name: "Z.AI Coding Plan",
      description:
        "Removed and unsupported: HTTP compatibility does not authorize Coding Plan use in Diffgazer.",
    },
    migration: {
      targetProductId: "zai",
      credentialHandling: "retain-until-explicit-delete-never-copy-test-or-send",
      actions: ["create-new-zai-configuration", "delete-removed-record"],
    },
  },
} as const satisfies ProductRegistry;

export type CandidateVerdict = "experimental" | "deferred" | "rejected";

export interface CandidateProductVerdict<ProductId extends CandidateProductId> {
  readonly id: ProductId;
  readonly name: string;
  readonly verdict: CandidateVerdict;
  readonly runnable: false;
  readonly visibleInSetup: false;
  readonly transportFamily: TransportFamily | null;
  readonly reason: string;
  readonly reconsiderWhen: string;
}

type CandidateVerdictRegistry = {
  readonly [ProductId in CandidateProductId]: CandidateProductVerdict<ProductId>;
};

export const CANDIDATE_VERDICTS = {
  "xiaomi-mimo": {
    id: "xiaomi-mimo",
    name: "Xiaomi MiMo PAYG",
    verdict: "experimental",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "Ordinary international account access, funding, and review reliability are unproven.",
    reconsiderWhen:
      "A funded eligible account passes exact schema, usage, latency, and moderation proof.",
  },
  "byteplus-modelark": {
    id: "byteplus-modelark",
    name: "BytePlus ModelArk",
    verdict: "experimental",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason:
      "Tenant-specific model activation, regional availability, and strict output remain unproven.",
    reconsiderWhen:
      "An eligible tenant passes exact regional model, schema, price, and limit proof.",
  },
  "cloudflare-workers-ai": {
    id: "cloudflare-workers-ai",
    name: "Cloudflare Workers AI",
    verdict: "experimental",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "Account-scoped setup and reliable JSON Schema conformance need separate proof.",
    reconsiderWhen:
      "A narrow model allowlist passes repeated schema and account-bound privacy proof.",
  },
  vllm: {
    id: "vllm",
    name: "vLLM",
    verdict: "experimental",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "local-http",
    reason:
      "Structured output depends on runtime configuration and remote deployments exceed local scope.",
    reconsiderWhen:
      "A separately scoped loopback profile passes version-bound schema and abort proof.",
  },
  "minimax-token-plan": {
    id: "minimax-token-plan",
    name: "MiniMax Token Plan",
    verdict: "experimental",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "The individual plan is throttled and lacks an established review schema contract.",
    reconsiderWhen:
      "A user-triggered plan scope proves authorization, privacy, schema output, and bounds.",
  },
  "kimi-code-cli": {
    id: "kimi-code-cli",
    name: "Kimi Code CLI",
    verdict: "experimental",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "local-cli",
    reason: "Prompt mode may approve tool calls and lacks a proven side-effect-free profile.",
    reconsiderWhen:
      "A pinned release passes deny, isolation, schema, account, and cancellation proof.",
  },
  "kiro-cli": {
    id: "kiro-cli",
    name: "Kiro CLI",
    verdict: "experimental",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "local-cli",
    reason: "Authorization and a pinned no-tools, no-MCP review profile remain unproven.",
    reconsiderWhen:
      "AWS confirms this integration and a pinned profile passes all negative proofs.",
  },
  "cursor-agent-cli": {
    id: "cursor-agent-cli",
    name: "Cursor Agent CLI",
    verdict: "experimental",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "local-cli",
    reason: "The beta agent-first CLI lacks a proven side-effect-free review profile.",
    reconsiderWhen:
      "A pinned release passes auth, deny, isolation, privacy, schema, and cancellation proof.",
  },
  "minimax-payg": {
    id: "minimax-payg",
    name: "MiniMax PAYG",
    verdict: "deferred",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "Current review-oriented models lack a documented structured-output contract.",
    reconsiderWhen:
      "An exact model documents and passes structured output plus terminal usage proof.",
  },
  "tencent-hunyuan-tokenhub": {
    id: "tencent-hunyuan-tokenhub",
    name: "Tencent Hunyuan / TokenHub",
    verdict: "deferred",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "The migration leaves model, price, region, output, and data terms unstable.",
    reconsiderWhen: "TokenHub publishes a stable purchasable contract and passes end-to-end proof.",
  },
  "opencode-cli": {
    id: "opencode-cli",
    name: "OpenCode CLI",
    verdict: "deferred",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "local-cli",
    reason:
      "Permissive defaults, event volatility, and subscription authorization remain unresolved.",
    reconsiderWhen:
      "A pinned authorized profile passes deny, isolation, schema, and cancellation proof.",
  },
  "hugging-face-inference-providers": {
    id: "hugging-face-inference-providers",
    name: "Hugging Face Inference Providers",
    verdict: "deferred",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason:
      "Downstream route, privacy, region, license, and schema properties are provider-specific.",
    reconsiderWhen:
      "One pinned downstream route can be persisted, disclosed, and conformance-proven.",
  },
  "together-ai": {
    id: "together-ai",
    name: "Together AI",
    verdict: "deferred",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "No distinct cost, capability, or privacy benefit over the selected tranche is proven.",
    reconsiderWhen:
      "A distinct exact product advantage and full conformance proof are established.",
  },
  "fireworks-ai": {
    id: "fireworks-ai",
    name: "Fireworks AI",
    verdict: "deferred",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "No distinct model, availability, cost, or privacy advantage is proven.",
    reconsiderWhen:
      "A distinct exact product advantage and full conformance proof are established.",
  },
  "remote-custom-url": {
    id: "remote-custom-url",
    name: "Arbitrary remote custom URL",
    verdict: "deferred",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "A general remote connector would create an unbounded proxy and SSRF surface.",
    reconsiderWhen: "A separately scoped trust and endpoint policy is approved and proven.",
  },
  "compatible-api-vendor-sdk": {
    id: "compatible-api-vendor-sdk",
    name: "Per-vendor compatible API SDK",
    verdict: "deferred",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "Ordinary compatible APIs do not justify additional vendor runtime dependencies.",
    reconsiderWhen: "A safely typed protocol incompatibility is demonstrated.",
  },
  "zai-coding-plan": {
    id: "zai-coding-plan",
    name: "Z.AI GLM Coding Plan",
    verdict: "rejected",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "Plan terms do not authorize direct use by a Diffgazer-owned service.",
    reconsiderWhen: "Written authorization covers this exact third-party integration.",
  },
  "kimi-code-http": {
    id: "kimi-code-http",
    name: "Kimi Code direct HTTP",
    verdict: "rejected",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "Plan benefits are limited to supported tools and do not authorize this client.",
    reconsiderWhen: "Written authorization covers this exact direct integration.",
  },
  "alibaba-coding-plan": {
    id: "alibaba-coding-plan",
    name: "Alibaba Coding / Token Plan",
    verdict: "rejected",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "Plan endpoints are restricted to supported coding tools, not backend services.",
    reconsiderWhen: "Written authorization covers this exact backend integration.",
  },
  "byteplus-coding-plan": {
    id: "byteplus-coding-plan",
    name: "BytePlus Coding / Token Plan",
    verdict: "rejected",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason:
      "Plan endpoints are restricted to supported coding tools and unauthorized use risks suspension.",
    reconsiderWhen: "Written authorization covers this exact backend integration.",
  },
  "volcengine-ark": {
    id: "volcengine-ark",
    name: "Volcengine Ark",
    verdict: "rejected",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason:
      "No official global account, billing, regional-processing, and availability contract exists.",
    reconsiderWhen: "A suitable official non-China product contract is published and proven.",
  },
  "gemini-cli": {
    id: "gemini-cli",
    name: "Gemini CLI OAuth / subscription",
    verdict: "rejected",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "local-cli",
    reason:
      "Google prohibits third-party use of Gemini CLI OAuth and the individual service ended.",
    reconsiderWhen: "A separately approved BYOK API product is evaluated.",
  },
  "claude-code": {
    id: "claude-code",
    name: "Claude Code subscription",
    verdict: "rejected",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "local-cli",
    reason:
      "Anthropic forbids unapproved third parties from offering Claude subscription login or limits.",
    reconsiderWhen: "Anthropic provides written authorization for this exact integration.",
  },
  "github-models": {
    id: "github-models",
    name: "GitHub Models",
    verdict: "rejected",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "The inference API and related service are retired and return HTTP 410.",
    reconsiderWhen: "A new official service receives a separate product decision.",
  },
  "nvidia-api-catalog": {
    id: "nvidia-api-catalog",
    name: "NVIDIA hosted API Catalog/build API",
    verdict: "rejected",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "Evaluation terms do not permit the repository-input and product use required here.",
    reconsiderWhen: "A suitable commercial contract and exact provider proof are established.",
  },
  "sdk-product-registry": {
    id: "sdk-product-registry",
    name: "AI SDK registry as product authority",
    verdict: "rejected",
    runnable: false,
    visibleInSetup: false,
    transportFamily: null,
    reason:
      "An SDK registry does not own Diffgazer product, readiness, notice, or persistence policy.",
    reconsiderWhen: "Never; SDK compatibility remains observation data, not product eligibility.",
  },
} as const satisfies CandidateVerdictRegistry;
