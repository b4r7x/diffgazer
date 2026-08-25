import { describe, expect, it } from "vitest";
import { ClientConfigurationInputSchema } from "../schemas/config/provider-config.js";
import {
  CANDIDATE_PRODUCT_IDS,
  DEFERRED_PRODUCT_IDS,
  EXPERIMENTAL_PRODUCT_IDS,
  HostedApiProductIdSchema,
  LOCAL_OPENAI_PRESET_ENDPOINTS,
  REJECTED_PRODUCT_IDS,
} from "../schemas/config/transports.js";
import { CANDIDATE_VERDICTS } from "./candidate-verdicts.js";
import { isPinnedDownstreamRouteModelId } from "./model-policy.js";
import { PRODUCT_ENDPOINT_TUPLES } from "./product-endpoints.js";
import {
  isModelIdAllowedForProduct,
  PRODUCT_REGISTRY,
  SELECTABLE_PRODUCT_IDS,
} from "./product-registry.js";

const HOSTED_CHECKS = [
  "credential",
  "endpoint",
  "model-discovery",
  "structured-output",
  "usage",
  "acknowledgement",
];
const LOCAL_HTTP_CHECKS = [
  "endpoint",
  "loopback",
  "model-discovery",
  "server-version",
  "structured-output",
  "cancellation",
  "acknowledgement",
];
const LOCAL_CLI_CHECKS = [
  "installation",
  "runtime-version",
  "account-plan",
  "model-discovery",
  "negative-capabilities",
  "structured-output",
  "cancellation",
  "acknowledgement",
];

function notice(id: string, billing: string[], privacy: string[]) {
  return {
    id,
    noticeVersion: 1,
    acknowledgement: "required",
    acknowledgeBefore: "first-context-send",
    renewAcknowledgementOn: "material-notice-change",
    billing,
    privacy,
  };
}

const FORBIDDEN_SERIALIZED_KEY =
  /(?:secret|apikey|token)|(?:env(?:ironment)?(?:name|value|reference)?|arguments?|argv|path|account(?:id|identifier|reference|secret)?|workspace(?:id|identifier|reference|secret)?|auth(?:entication)?(?:path|token|value|file|state|store|evidence)?|executable(?:path|digest|identity|version)?|adapter|command|rawevidence)$/i;

const FORBIDDEN_SERIALIZED_VALUE = [
  /\b[A-Z][A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD)\b/,
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9+/_=.:-]{4,}/i,
  /\b(?:sk|gsk|gh[pousr]|github_pat)[-_][A-Za-z0-9_-]{8,}\b/i,
  /^(?:--[A-Za-z]|-[A-Za-z](?:$|\s)|\/|~[/\\]|[A-Za-z]:[/\\])/,
  /\b(?:acct|account|workspace|ws)[_:][A-Za-z0-9-]{4,}\b/i,
  /\b(?:account|workspace|ws)-(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{4,}\b/i,
];

function hasForbiddenSerializedData(descriptor: unknown): boolean {
  const pending: unknown[] = [JSON.parse(JSON.stringify(descriptor))];

  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value === "string") {
      if (FORBIDDEN_SERIALIZED_VALUE.some((pattern) => pattern.test(value))) return true;
      continue;
    }
    if (Array.isArray(value)) {
      pending.push(...value);
      continue;
    }
    if (!value || typeof value !== "object") continue;

    for (const [key, child] of Object.entries(value)) {
      const normalizedKey = key.replaceAll(/[-_]/g, "");
      if (FORBIDDEN_SERIALIZED_KEY.test(normalizedKey)) return true;
      pending.push(child);
    }
  }

  return false;
}

describe("product registry authority", () => {
  it("references the shared endpoint tuple instead of copying it", () => {
    expect(PRODUCT_REGISTRY.gemini.configuration.endpoints).toBe(PRODUCT_ENDPOINT_TUPLES.gemini);
  });

  it("enumerates exactly the 12 selectable products with add-now notices and gates", () => {
    expect(SELECTABLE_PRODUCT_IDS).toEqual([
      "gemini",
      "zai",
      "openrouter",
      "groq",
      "cerebras",
      "deepseek",
      "ollama-cloud",
      "opencode-zen",
      "ollama",
      "local-openai",
      "codex-cli",
      "copilot-cli",
    ]);

    const selectableEntries = Object.values(PRODUCT_REGISTRY).filter(
      (product) => product.kind === "runnable",
    );
    expect(selectableEntries.map((product) => product.id)).toEqual(SELECTABLE_PRODUCT_IDS);

    for (const product of selectableEntries) {
      expect(product.selectable).toBe(true);
      expect(product.notice.acknowledgement).toBe("required");
      expect(product.notice.acknowledgeBefore).toBe("first-context-send");
      expect(product.notice.noticeVersion).toBeGreaterThan(0);
      expect(product.notice.billing.length).toBeGreaterThan(0);
      expect(product.notice.privacy.length).toBeGreaterThan(0);
      expect(product.admission.requiredChecks).toContain("model-discovery");
      expect(product.admission.requiredChecks).toContain("structured-output");
      expect(product.admission.requiredChecks).toContain("acknowledgement");
      expect(product.modelPolicy.aliases).toBe("forbidden");
    }
  });

  it("uses one endpoint tuple authority for validation and presentation", () => {
    for (const productId of SELECTABLE_PRODUCT_IDS) {
      expect(PRODUCT_REGISTRY[productId].configuration.endpoints).toBe(
        PRODUCT_ENDPOINT_TUPLES[productId],
      );
    }

    for (const productId of SELECTABLE_PRODUCT_IDS) {
      if (!HostedApiProductIdSchema.safeParse(productId).success) continue;

      for (const endpoint of PRODUCT_ENDPOINT_TUPLES[productId]) {
        const input = {
          transportFamily: "hosted-api" as const,
          productId,
          endpoint: endpoint.endpoint,
        };

        expect(ClientConfigurationInputSchema.parse(input)).toEqual(input);
      }
    }

    for (const endpoint of PRODUCT_ENDPOINT_TUPLES["local-openai"]) {
      expect(LOCAL_OPENAI_PRESET_ENDPOINTS[endpoint.id as "lm-studio" | "llama-cpp"]).toBe(
        endpoint.endpoint,
      );
    }
  });

  it("pins every selectable product's endpoint, model, gate, and notice policy", () => {
    const policies = SELECTABLE_PRODUCT_IDS.map((productId) => {
      const product = PRODUCT_REGISTRY[productId];
      return {
        id: productId,
        endpoints: product.configuration.endpoints,
        modelPolicy: product.modelPolicy,
        checks: product.admission.requiredChecks,
        structuredOutput: product.admission.structuredOutput,
        usage: product.admission.usage,
        notice: product.notice,
      };
    });

    expect(policies).toEqual([
      {
        id: "gemini",
        endpoints: [
          {
            id: "global",
            label: "Global",
            endpoint: "https://generativelanguage.googleapis.com/v1beta",
          },
        ],
        modelPolicy: {
          kind: "discovered-exact",
          suggestedModelId: "gemini-2.5-flash",
          aliases: "forbidden",
        },
        checks: HOSTED_CHECKS,
        structuredOutput: "strict-json-schema",
        usage: "optional",
        notice: notice(
          "gemini-hosted-api",
          ["Free and paid availability depends on the selected account and exact model."],
          ["Data handling follows the configured Google API product and account terms."],
        ),
      },
      {
        id: "zai",
        endpoints: [
          {
            id: "general-payg",
            label: "General Open Platform PAYG",
            endpoint: "https://api.z.ai/api/paas/v4",
          },
        ],
        modelPolicy: {
          kind: "discovered-exact",
          suggestedModelId: "glm-5-turbo",
          aliases: "forbidden",
        },
        checks: HOSTED_CHECKS,
        structuredOutput: "json-object-local-validation",
        usage: "optional",
        notice: notice(
          "zai-general-payg",
          ["This configuration uses general Open Platform pay-as-you-go billing."],
          ["API no-training and data-handling claims apply only to the exact general PAYG route."],
        ),
      },
      {
        id: "openrouter",
        endpoints: [
          { id: "api", label: "OpenRouter API", endpoint: "https://openrouter.ai/api/v1" },
        ],
        modelPolicy: {
          kind: "pinned-downstream-route",
          routePolicy: "pinned",
          automaticRouting: "forbidden",
          aliases: "forbidden",
        },
        checks: [...HOSTED_CHECKS, "downstream-route"],
        structuredOutput: "strict-json-schema",
        usage: "optional",
        notice: notice(
          "openrouter-pinned-route",
          ["Billing and availability are disclosed for the exact pinned downstream route."],
          [
            "Provider, region, license, and retention facts come from the pinned route, not the aggregator brand.",
          ],
        ),
      },
      {
        id: "groq",
        endpoints: [{ id: "global", label: "Global", endpoint: "https://api.groq.com/openai/v1" }],
        modelPolicy: {
          kind: "discovered-exact",
          suggestedModelId: "openai/gpt-oss-120b",
          aliases: "forbidden",
        },
        checks: HOSTED_CHECKS,
        structuredOutput: "strict-json-schema",
        usage: "optional",
        notice: notice(
          "groq-hosted-api",
          ["Current account and model limits are verified during setup."],
          ["Data handling follows the selected Groq API account and model terms."],
        ),
      },
      {
        id: "cerebras",
        endpoints: [{ id: "global", label: "Global", endpoint: "https://api.cerebras.ai/v1" }],
        modelPolicy: {
          kind: "discovered-exact",
          suggestedModelId: "gpt-oss-120b",
          aliases: "forbidden",
        },
        checks: HOSTED_CHECKS,
        structuredOutput: "strict-json-schema",
        usage: "optional",
        notice: notice(
          "cerebras-hosted-api",
          ["Current account and model limits are verified during setup."],
          ["Data handling follows the selected Cerebras API account and model terms."],
        ),
      },
      {
        id: "deepseek",
        endpoints: [
          {
            id: "payg",
            label: "Open Platform PAYG",
            endpoint: "https://api.deepseek.com/v1",
          },
        ],
        modelPolicy: {
          kind: "discovered-allowlist",
          modelIds: ["deepseek-v4-flash", "deepseek-v4-pro"],
          suggestedModelId: "deepseek-v4-flash",
          higherCostModelIds: ["deepseek-v4-pro"],
          aliases: "forbidden",
        },
        checks: HOSTED_CHECKS,
        structuredOutput: "json-object-local-validation",
        usage: "required-terminal",
        notice: notice(
          "deepseek-payg-prc",
          ["This is opt-in pay-as-you-go usage with account-specific limits."],
          [
            "Inputs and outputs may be processed and stored in the PRC.",
            "Retention duration is uncertain and the service-improvement setting provides an opt-out.",
            "DeepSeek is not presented as zero retention.",
          ],
        ),
      },
      {
        id: "ollama-cloud",
        endpoints: [{ id: "cloud", label: "Ollama Cloud", endpoint: "https://ollama.com/v1" }],
        modelPolicy: {
          kind: "discovered-exact",
          suggestedModelId: "gpt-oss:20b",
          aliases: "forbidden",
        },
        checks: HOSTED_CHECKS,
        structuredOutput: "json-object-local-validation",
        usage: "optional",
        notice: notice(
          "ollama-cloud-hosted-api",
          [
            "Usage counts against the account's Ollama plan quota (Free, Pro, or Max) in 5-hour session and 7-day weekly windows; no per-token price is published.",
          ],
          [
            "Ollama states that cloud prompts and responses are not logged, stored, or trained on.",
            "Repository content is sent to ollama.com; this is not the loopback Ollama transport.",
          ],
        ),
      },
      {
        id: "opencode-zen",
        endpoints: [{ id: "zen", label: "OpenCode Zen", endpoint: "https://opencode.ai/zen/v1" }],
        // No suggested model: Zen rotates stealth routes, so a pinned guess
        // would outlive the model it names.
        modelPolicy: { kind: "discovered-exact", aliases: "forbidden" },
        checks: HOSTED_CHECKS,
        structuredOutput: "json-object-local-validation",
        usage: "optional",
        notice: notice(
          "opencode-zen-hosted-api",
          [
            "Zen pay-as-you-go credits: each request is charged per token against the account's Zen credit balance.",
            "OpenCode Go subscription: the same key and endpoint draw on the subscription's included usage instead of credits.",
          ],
          [
            "Free and stealth Zen models may retain prompts and train on them.",
            "Paid routes are mostly zero-retention; OpenAI- and Anthropic-backed models retain data for 30 days.",
          ],
        ),
      },
      {
        id: "ollama",
        endpoints: [
          { id: "default", label: "Default loopback", endpoint: "http://127.0.0.1:11434" },
        ],
        modelPolicy: { kind: "discovered-exact", aliases: "forbidden" },
        checks: LOCAL_HTTP_CHECKS,
        structuredOutput: "strict-json-schema",
        usage: "optional",
        notice: notice(
          "ollama-loopback",
          ["No zero-cost or adequate-hardware claim is inferred from local operation."],
          [
            "Diffgazer verifies only that the first network hop is loopback.",
            "Any downstream routing, data residency, storage, or telemetry is the selected server operator's responsibility.",
            "Ollama Cloud is not this transport; the separate Ollama Cloud product reaches ollama.com.",
          ],
        ),
      },
      {
        id: "local-openai",
        endpoints: [
          {
            id: "lm-studio",
            label: "LM Studio",
            endpoint: LOCAL_OPENAI_PRESET_ENDPOINTS["lm-studio"],
          },
          {
            id: "llama-cpp",
            label: "llama.cpp",
            endpoint: LOCAL_OPENAI_PRESET_ENDPOINTS["llama-cpp"],
          },
        ],
        modelPolicy: { kind: "discovered-exact", aliases: "forbidden" },
        checks: LOCAL_HTTP_CHECKS,
        structuredOutput: "strict-json-schema",
        usage: "optional",
        notice: notice(
          "local-openai-loopback",
          ["No zero-cost or adequate-hardware claim is inferred from local operation."],
          [
            "Diffgazer verifies only that the first network hop is loopback.",
            "Any downstream routing, data residency, storage, or telemetry is the selected server operator's responsibility.",
          ],
        ),
      },
      {
        id: "codex-cli",
        endpoints: [],
        modelPolicy: { kind: "discovered-exact", aliases: "forbidden" },
        checks: LOCAL_CLI_CHECKS,
        structuredOutput: "pinned-cli-terminal-schema",
        usage: "optional",
        notice: notice(
          "codex-cli-account",
          ["The active account and plan class determine credits, rate limits, or API billing."],
          [
            "Consumer and business/API data handling differ and must match the active account posture.",
            "Diffgazer uses existing vendor-managed local auth and does not import or proxy credentials.",
          ],
        ),
      },
      {
        id: "copilot-cli",
        endpoints: [],
        modelPolicy: { kind: "discovered-exact", aliases: "forbidden" },
        checks: LOCAL_CLI_CHECKS,
        structuredOutput: "pinned-cli-terminal-schema",
        usage: "optional",
        notice: notice(
          "copilot-cli-account",
          ["The active plan and policy determine model entitlement, credits, and rate limits."],
          [
            "Individual and business/enterprise data protections differ and must match the active plan.",
            "Diffgazer uses existing vendor-managed local auth and does not import or proxy credentials.",
          ],
        ),
      },
    ]);
  });

  it("keeps setup and rejected-candidate copy scoped to verified products", () => {
    expect(PRODUCT_REGISTRY["codex-cli"].presentation.description).toBe(
      "A user-owned Codex CLI installation with vendor-managed local auth; support requires matching exact compatibility evidence.",
    );
    expect(PRODUCT_REGISTRY["copilot-cli"].presentation.description).toBe(
      "A user-owned Copilot CLI installation with vendor-managed local auth; support requires matching exact compatibility evidence.",
    );
    expect(CANDIDATE_VERDICTS["byteplus-coding-plan"].name).toBe("BytePlus Coding / Token Plan");
    expect(CANDIDATE_VERDICTS["nvidia-api-catalog"].name).toBe(
      "NVIDIA hosted API Catalog/build API",
    );
  });

  // A pinned variant suffix names a separately priced catalog identity, so it is
  // admitted; a dynamic selector is a request-time sort or route instruction and
  // is not, and an unknown suffix fails closed rather than riding in on shape.
  it("rejects routing selectors by segment while preserving substring-bearing routes", () => {
    const rejected = [
      "auto/model",
      "provider/automatic",
      "provider/openrouter",
      "provider/fallback",
      "provider/model/online",
      "openrouter/auto",
      "openrouter/free",
      "provider/model:nitro",
      "provider/model:floor",
      "provider/model:online",
      "provider/model:exacto",
      "provider/model:extended",
      "provider/model:free:nitro",
    ];
    const accepted = [
      "automaticity/model",
      "provider/openrouterish",
      "provider/fallback-v2",
      "provider/online-model",
      "provider/model:free",
      "provider/model:thinking",
    ];

    for (const modelId of rejected) {
      expect(isPinnedDownstreamRouteModelId(modelId), modelId).toBe(false);
    }
    for (const modelId of accepted) {
      expect(isPinnedDownstreamRouteModelId(modelId), modelId).toBe(true);
    }
  });

  it("keeps GitHub Models hidden and every candidate non-runnable", () => {
    expect(Object.keys(CANDIDATE_VERDICTS)).toEqual(CANDIDATE_PRODUCT_IDS);

    for (const productId of EXPERIMENTAL_PRODUCT_IDS) {
      expect(CANDIDATE_VERDICTS[productId]).toMatchObject({
        verdict: "experimental",
        runnable: false,
        visibleInSetup: false,
      });
    }
    for (const productId of DEFERRED_PRODUCT_IDS) {
      expect(CANDIDATE_VERDICTS[productId]).toMatchObject({
        verdict: "deferred",
        runnable: false,
        visibleInSetup: false,
      });
    }
    for (const productId of REJECTED_PRODUCT_IDS) {
      expect(CANDIDATE_VERDICTS[productId]).toMatchObject({
        verdict: "rejected",
        runnable: false,
        visibleInSetup: false,
      });
    }

    expect(CANDIDATE_VERDICTS["github-models"]).toMatchObject({
      verdict: "rejected",
      runnable: false,
      visibleInSetup: false,
    });
    expect(PRODUCT_REGISTRY).not.toHaveProperty("github-models");
  });

  it("keeps registry and candidate identities complete and disjoint", () => {
    expect(Object.keys(PRODUCT_REGISTRY)).toEqual([...SELECTABLE_PRODUCT_IDS]);
    expect(Object.keys(CANDIDATE_VERDICTS)).toEqual(CANDIDATE_PRODUCT_IDS);

    const allProductIds = [...SELECTABLE_PRODUCT_IDS, ...CANDIDATE_PRODUCT_IDS];
    expect(new Set(allProductIds).size).toBe(allProductIds.length);
  });

  it("serializes no forbidden key variant or sensitive value for any product", () => {
    const descriptors = [...Object.values(PRODUCT_REGISTRY), ...Object.values(CANDIDATE_VERDICTS)];

    for (const descriptor of descriptors) {
      expect(hasForbiddenSerializedData(descriptor)).toBe(false);
    }
  });
});

describe("the registry-owned model policy predicate", () => {
  it.each([
    { productId: "zai", modelId: "glm-4.7", allowed: true },
    { productId: "zai", modelId: "glm-4.7-flash", allowed: true },
    { productId: "deepseek", modelId: "deepseek-v4-flash", allowed: true },
    { productId: "deepseek", modelId: "deepseek-v5-flash", allowed: false },
    { productId: "openrouter", modelId: "openai/gpt-4.1-mini", allowed: true },
    { productId: "openrouter", modelId: "openrouter/auto", allowed: false },
    { productId: "gemini", modelId: "gemini-2.5-flash", allowed: true },
  ] as const)("decides $productId/$modelId as allowed=$allowed", ({
    productId,
    modelId,
    allowed,
  }) => {
    expect(isModelIdAllowedForProduct(productId, modelId)).toBe(allowed);
  });

  it("is the only interpretation every product policy kind is measured against", () => {
    const coveredKinds = new Set(
      SELECTABLE_PRODUCT_IDS.map((productId) => PRODUCT_REGISTRY[productId].modelPolicy.kind),
    );

    expect(coveredKinds).toEqual(
      new Set(["discovered-exact", "discovered-allowlist", "pinned-downstream-route"]),
    );
  });
});
