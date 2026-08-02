import { describe, expect, it } from "vitest";
import { REMOVED_PRODUCT_ID } from "../schemas/config/providers.js";
import {
  CANDIDATE_PRODUCT_IDS,
  DEFERRED_PRODUCT_IDS,
  EXPERIMENTAL_PRODUCT_IDS,
  HostedApiProductIdSchema,
  LOCAL_OPENAI_PRESET_ENDPOINTS,
  REJECTED_PRODUCT_IDS,
  REMOVED_PRODUCT_IDS,
  TransportInputSchema,
} from "../schemas/config/transports.js";
import {
  CANDIDATE_VERDICTS,
  isModelIdAllowedForProduct,
  isPinnedDownstreamRouteModelId,
  PRODUCT_ENDPOINT_TUPLES,
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
  it("enumerates exactly the 13 selectable products with add-now notices and gates", () => {
    expect(SELECTABLE_PRODUCT_IDS).toEqual([
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
          ...("region" in endpoint ? { region: endpoint.region } : {}),
          ...("workspaceBound" in endpoint ? { workspace: "workspace-reference" } : {}),
        };

        expect(TransportInputSchema.parse(input)).toEqual(input);
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
          suggestedModelId: "glm-4.7",
          explicitOptInSuffixes: ["-flash"],
          aliases: "forbidden",
        },
        checks: HOSTED_CHECKS,
        structuredOutput: "json-object-local-validation",
        usage: "optional",
        notice: notice(
          "zai-general-payg",
          ["This configuration uses general Open Platform PAYG, never Coding Plan quota."],
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
        id: "qwen",
        endpoints: [
          {
            id: "international",
            label: "International",
            endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
            region: "international",
            workspaceBound: true,
          },
        ],
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
        checks: [...HOSTED_CHECKS, "region", "workspace"],
        structuredOutput: "json-object-local-validation",
        usage: "required-terminal",
        notice: notice(
          "qwen-international-payg",
          [
            "The selected international region and workspace determine billing and availability.",
            "No international free quota is promised.",
            "Coding Plan and Token Plan credentials are excluded.",
          ],
          [
            "The selected international region and workspace are bound to the configuration.",
            "Provider material permits retention where required by law and gives no fixed retention period.",
          ],
        ),
      },
      {
        id: "moonshot",
        endpoints: [
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
        modelPolicy: {
          kind: "discovered-family",
          familyPrefixes: ["kimi-k3", "kimi-k2.6"],
          rejectedAliases: ["kimi-latest", "latest"],
          aliases: "forbidden",
        },
        checks: [...HOSTED_CHECKS, "region"],
        structuredOutput: "strict-json-schema",
        usage: "required-terminal",
        notice: notice(
          "moonshot-open-platform-payg",
          ["Mainland and international accounts, balances, and endpoints are isolated."],
          [
            "API no-training claims apply only to the selected Open Platform PAYG route.",
            "Consumer and Kimi Code products have different terms and are not substituted.",
          ],
        ),
      },
      {
        id: "mistral",
        endpoints: [
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
        modelPolicy: {
          kind: "discovered-allowlist",
          modelIds: ["mistral-small-2603"],
          suggestedModelId: "mistral-small-2603",
          aliases: "forbidden",
        },
        checks: [...HOSTED_CHECKS, "region"],
        structuredOutput: "strict-json-schema",
        usage: "optional",
        notice: notice(
          "mistral-regional-api",
          [
            "The selected global or EU endpoint and account determine price and limits.",
            "Free mode is evaluation/prototyping, not unlimited production capacity.",
          ],
          [
            "Submitted data may be used for training unless the account opts out.",
            "API inputs and outputs normally have rolling 30-day retention.",
            "Zero data retention requires an eligible approved arrangement and is never inferred.",
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
            "Ollama Cloud is not this transport.",
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

  it("keeps REMOVED_PRODUCT_ID decoder-only with explicit migration and deletion", () => {
    const removed = PRODUCT_REGISTRY[REMOVED_PRODUCT_ID];

    expect(removed).toMatchObject({
      kind: "removed",
      selectable: false,
      decoderOnly: true,
      migration: {
        targetProductId: "zai",
        credentialHandling: "retain-until-explicit-delete-never-copy-test-or-send",
        actions: ["create-new-zai-configuration", "delete-removed-record"],
      },
    });
    expect(SELECTABLE_PRODUCT_IDS).not.toContain(REMOVED_PRODUCT_ID);
  });

  it("keeps Qwen Plus opt-in and evidence-gated without inventing a limit", () => {
    const policy = PRODUCT_REGISTRY.qwen.modelPolicy;

    expect(policy).toMatchObject({
      kind: "discovered-allowlist",
      modelIds: ["qwen3-coder-flash", "qwen3-coder-plus"],
      suggestedModelId: "qwen3-coder-flash",
      higherCostModelIds: ["qwen3-coder-plus"],
      higherCostModelEvidence: {
        outputLimit: "required",
        reviewConformance: "required",
      },
      aliases: "forbidden",
    });

    if (policy.kind !== "discovered-allowlist") throw new Error("Unexpected Qwen policy kind");
    expect(policy.suggestedModelId).toBe("qwen3-coder-flash");
    expect(policy.higherCostModelIds).toEqual(["qwen3-coder-plus"]);
    expect(policy.higherCostModelEvidence).toEqual({
      outputLimit: "required",
      reviewConformance: "required",
    });
    expect(policy).not.toHaveProperty("outputLimit");
    expect(JSON.stringify(policy)).not.toMatch(/\b\d{3,}\b/);
  });

  it("rejects routing selectors by segment while preserving substring-bearing routes", () => {
    const rejected = [
      "auto/model",
      "provider/automatic",
      "provider/openrouter",
      "provider/fallback",
      "provider/model:free",
      "provider/model/online",
    ];
    const accepted = [
      "automaticity/model",
      "provider/openrouterish",
      "provider/fallback-v2",
      "provider/online-model",
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

  it("keeps registry, removed, and candidate identities complete and disjoint", () => {
    expect(Object.keys(PRODUCT_REGISTRY)).toEqual([
      ...SELECTABLE_PRODUCT_IDS,
      ...REMOVED_PRODUCT_IDS,
    ]);
    expect(Object.keys(CANDIDATE_VERDICTS)).toEqual(CANDIDATE_PRODUCT_IDS);

    const allProductIds = [
      ...SELECTABLE_PRODUCT_IDS,
      ...REMOVED_PRODUCT_IDS,
      ...CANDIDATE_PRODUCT_IDS,
    ];
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
    // Z.AI Flash needs an explicit opt-in no V2 contract carries yet.
    { productId: "zai", modelId: "glm-4.7-flash", allowed: false },
    { productId: "deepseek", modelId: "deepseek-v4-flash", allowed: true },
    { productId: "deepseek", modelId: "deepseek-v5-flash", allowed: false },
    // Qwen Plus needs server-only higher-cost evidence.
    { productId: "qwen", modelId: "qwen3-coder-flash", allowed: true },
    { productId: "qwen", modelId: "qwen3-coder-plus", allowed: false },
    { productId: "moonshot", modelId: "kimi-k3-turbo", allowed: true },
    { productId: "moonshot", modelId: "kimi-latest", allowed: false },
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
      new Set([
        "discovered-exact",
        "discovered-allowlist",
        "discovered-family",
        "pinned-downstream-route",
      ]),
    );
  });
});
