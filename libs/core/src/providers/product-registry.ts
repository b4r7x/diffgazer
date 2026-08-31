import { RUNNABLE_PRODUCT_IDS, type RunnableProductId } from "../schemas/config/product-ids.js";
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
  readonly structuredOutput: "strict-json-schema" | "json-object-local-validation";
}

export interface RunnableProductDescriptor<ProductId extends RunnableProductId> {
  readonly id: ProductId;
  readonly kind: "runnable";
  readonly selectable: true;
  readonly transportFamily: "hosted-api";
  readonly presentation: {
    readonly name: string;
    /** Short human form for compact surfaces; falls back to `name` when absent. */
    readonly shortName?: string;
    readonly description: string;
    readonly setupLabel: string;
  };
  readonly configuration: {
    readonly credentialKind: "hosted-api-key-reference";
    readonly fields: readonly ConfigurationField[];
    readonly endpoints: readonly EndpointProfile[];
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

/**
 * Every runnable product is selectable: `ProductRegistry` maps over the whole
 * `RunnableProductId` union and every descriptor is `selectable: true`. Deriving
 * the picker order from the runnable tuple keeps one identity authority instead
 * of a second hand-maintained id list.
 */
export const SELECTABLE_PRODUCT_IDS = RUNNABLE_PRODUCT_IDS;

export const PRODUCT_REGISTRY = {
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
  "opencode-zen": {
    id: "opencode-zen",
    kind: "runnable",
    selectable: true,
    transportFamily: "hosted-api",
    presentation: {
      name: "OpenCode Zen",
      shortName: "OpenCode",
      description:
        "OpenCode's hosted OpenAI-compatible gateway, billed as Zen credits or an OpenCode Go subscription.",
      setupLabel: "Configure OpenCode Zen",
    },
    configuration: {
      credentialKind: "hosted-api-key-reference",
      fields: ["credential"],
      endpoints: PRODUCT_ENDPOINT_TUPLES["opencode-zen"],
    },
    // Zen publishes no stable allowlist and rotates stealth models, so every id
    // comes from discovery — the live `/models` list, or the models.dev catalog
    // when that list cannot be fetched; no model is suggested because a pinned
    // guess would outlive the route it names.
    modelPolicy: {
      kind: "discovered-exact",
      aliases: "forbidden",
    },
    admission: {
      requiredChecks: HOSTED_CHECKS,
      structuredOutput: "json-object-local-validation",
    },
    // One key serves two purchases on separate endpoints, so both are named: a
    // user on OpenCode Go must not read a credit-only posture and assume a
    // second bill.
    billing: {
      modes: ["pay-as-you-go", "subscription-credit"],
      posture:
        "One key serves two purchases on separate endpoints: Zen pay-as-you-go credits at /zen/v1, or the OpenCode Go subscription at /zen/go/v1.",
    },
    // noticeVersion 2: the v1 notice claimed one endpoint served both
    // purchases; Go now has its own endpoint, so a stale v1 acknowledgement
    // must not silently cover the corrected billing wording.
    notice: {
      id: "opencode-zen-hosted-api",
      noticeVersion: 2,
      acknowledgement: "required",
      acknowledgeBefore: "first-context-send",
      renewAcknowledgementOn: "material-notice-change",
      billing: [
        "Zen pay-as-you-go credits: each request on the Zen endpoint is charged per token against the account's Zen credit balance.",
        "OpenCode Go subscription: the same key on the Go endpoint draws on the subscription's included usage instead of credits.",
      ],
      privacy: [
        "Free and stealth Zen models may retain prompts and train on them.",
        "Paid routes are mostly zero-retention; OpenAI- and Anthropic-backed models retain data for 30 days.",
      ],
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
      kind: "discovered-exact",
      suggestedModelId: "deepseek-v4-flash",
      aliases: "forbidden",
    },
    admission: {
      requiredChecks: HOSTED_CHECKS,
      structuredOutput: "json-object-local-validation",
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
  qwen: {
    id: "qwen",
    kind: "runnable",
    selectable: true,
    transportFamily: "hosted-api",
    presentation: {
      name: "Qwen International",
      shortName: "Qwen",
      description: "Alibaba Model Studio international pay-as-you-go API.",
      setupLabel: "Configure Qwen International PAYG",
    },
    configuration: {
      credentialKind: "hosted-api-key-reference",
      fields: ["credential"],
      endpoints: PRODUCT_ENDPOINT_TUPLES.qwen,
    },
    modelPolicy: {
      kind: "discovered-exact",
      suggestedModelId: "qwen3-coder-flash",
      aliases: "forbidden",
    },
    admission: {
      requiredChecks: HOSTED_CHECKS,
      structuredOutput: "json-object-local-validation",
    },
    billing: {
      modes: ["pay-as-you-go"],
      posture: "International PAYG only; no international free quota is promised.",
    },
    // noticeVersion 2: the pre-removal v1 notice bound region and workspace
    // claims that the simplified configuration no longer makes, so a stale v1
    // acknowledgement must not silently cover this reworded notice.
    notice: {
      id: "qwen-international-payg",
      noticeVersion: 2,
      acknowledgement: "required",
      acknowledgeBefore: "first-context-send",
      renewAcknowledgementOn: "material-notice-change",
      billing: [
        "The international endpoint and the owning account determine billing and availability.",
        "No international free quota is promised.",
        "Subscription plan credentials are excluded.",
      ],
      privacy: [
        "Requests go only to the international endpoint; mainland accounts and keys are separate.",
        "Provider material permits retention where required by law and gives no fixed retention period.",
      ],
    },
  },
  minimax: {
    id: "minimax",
    kind: "runnable",
    selectable: true,
    transportFamily: "hosted-api",
    presentation: {
      name: "MiniMax International",
      shortName: "MiniMax",
      description: "MiniMax open platform international pay-as-you-go API.",
      setupLabel: "Configure MiniMax International PAYG",
    },
    configuration: {
      credentialKind: "hosted-api-key-reference",
      fields: ["credential"],
      endpoints: PRODUCT_ENDPOINT_TUPLES.minimax,
    },
    modelPolicy: {
      kind: "discovered-exact",
      suggestedModelId: "MiniMax-M2.7",
      aliases: "forbidden",
    },
    admission: {
      requiredChecks: HOSTED_CHECKS,
      structuredOutput: "json-object-local-validation",
    },
    billing: {
      modes: ["pay-as-you-go"],
      posture: "International PAYG only; no free quota is promised.",
    },
    notice: {
      id: "minimax-international-payg",
      noticeVersion: 1,
      acknowledgement: "required",
      acknowledgeBefore: "first-context-send",
      renewAcknowledgementOn: "material-notice-change",
      billing: [
        "The international endpoint and the owning account determine billing and availability.",
        "No free quota is promised.",
        "Token Plan and subscription keys draw on separate account resources and are excluded.",
      ],
      privacy: [
        "Requests go only to the international endpoint; mainland accounts and keys are separate.",
        "Provider material permits retention as long as necessary or permitted by law and gives no fixed retention period.",
        "MiniMax is not presented as zero retention.",
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
      shortName: "Moonshot",
      description: "Moonshot/Kimi Open Platform pay-as-you-go API with isolated regions.",
      setupLabel: "Configure Moonshot PAYG",
    },
    configuration: {
      credentialKind: "hosted-api-key-reference",
      fields: ["credential"],
      endpoints: PRODUCT_ENDPOINT_TUPLES.moonshot,
    },
    modelPolicy: {
      kind: "discovered-exact",
      suggestedModelId: "kimi-k2.6",
      aliases: "forbidden",
    },
    admission: {
      requiredChecks: HOSTED_CHECKS,
      structuredOutput: "strict-json-schema",
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
