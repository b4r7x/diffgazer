import { describe, expect, it } from "vitest";
import {
  type ClientConfigurationSummary,
  ClientConfigurationSummarySchema,
} from "../schemas/config/provider-config.js";
import { READINESS_PRESENTATION, ReadinessSchema } from "../schemas/config/readiness.js";
import {
  REMOVED_PRODUCT_IDS,
  RUNNABLE_PRODUCT_IDS,
  type RunnableProductId,
} from "../schemas/config/transports.js";
import {
  ClientMetadataPayloadSchema,
  type ClientMetadataSource,
  ClientProductMetadataSchema,
  projectClientMetadata,
  projectClientProduct,
} from "./client-metadata.js";
import { PRODUCT_REGISTRY, type ProductNotice } from "./product-registry.js";

type TestReadinessStatus =
  | "unconfigured"
  | "credential-invalid"
  | "conformance-failed"
  | "acknowledgement-required"
  | "unsupported"
  | "removed"
  | "skipped"
  | "local-api-incompatible"
  | "local-selected-model-missing"
  | "local-cancellation-failed";

function readiness(status: TestReadinessStatus, productId: RunnableProductId) {
  const isObservedFailure =
    status === "credential-invalid" ||
    status === "conformance-failed" ||
    status.startsWith("local-");
  const isChecked =
    isObservedFailure || status === "skipped" || status === "acknowledgement-required";
  let evidenceStatus: "failed" | "skipped" | "passed" | "not-checked" = "not-checked";
  if (isObservedFailure) {
    evidenceStatus = "failed";
  } else if (status === "skipped") {
    evidenceStatus = "skipped";
  } else if (status === "acknowledgement-required") {
    evidenceStatus = "passed";
  }
  const notice = PRODUCT_REGISTRY[productId].notice;
  const acknowledgement =
    status === "removed" || status === "unsupported"
      ? { status: "not-applicable" as const }
      : {
          status: "required" as const,
          noticeId: notice.id,
          noticeVersion: notice.noticeVersion,
        };

  return ReadinessSchema.parse({
    status,
    ready: false,
    evidenceStatus,
    checkedAt: isChecked ? "2026-07-31T12:00:00.000Z" : null,
    acknowledgement,
    ...READINESS_PRESENTATION[status],
  });
}

function sourceForConfiguration(configuration: ClientConfigurationSummary): ClientMetadataSource {
  const status = configuration.status === "removed" ? "removed" : "unsupported";
  return {
    productId: configuration.productId,
    configuration,
    readiness: readiness(
      status,
      configuration.productId === "zai-coding" ? "qwen" : configuration.productId,
    ),
    notices: configuration.notices,
    actions: [...configuration.availableActions],
  };
}

function copyNotice(notice: ProductNotice) {
  return { ...notice, billing: [...notice.billing], privacy: [...notice.privacy] };
}

function selectedModelFor(productId: RunnableProductId): string {
  const policy = PRODUCT_REGISTRY[productId].modelPolicy;
  if (policy.kind === "discovered-allowlist") return policy.modelIds[0];
  if (policy.kind === "discovered-family") return policy.familyPrefixes[0];
  if (policy.kind === "pinned-downstream-route") return "openai/gpt-4.1-mini";
  return "suggestedModelId" in policy
    ? (policy.suggestedModelId ?? "discovered-model")
    : "discovered-model";
}

function readyConfigurationFor(productId: RunnableProductId): ClientConfigurationSummary {
  const product = PRODUCT_REGISTRY[productId];
  const base = {
    configurationId: `${productId}-ready`,
    revision: 1,
    status: "supported" as const,
    productId,
    selectedModelId: selectedModelFor(productId),
    notices: [copyNotice(product.notice)],
    availableActions: ["inspect", "select", "test", "update", "delete"] as const,
  };

  if (product.transportFamily === "hosted-api") {
    const endpoint = product.configuration.endpoints[0];
    return ClientConfigurationSummarySchema.parse({
      ...base,
      transportFamily: product.transportFamily,
      endpoint: endpoint.endpoint,
      ...(!("region" in endpoint) ? {} : { region: endpoint.region }),
      ...("workspaceBound" in endpoint ? { workspace: "workspace-reference" } : {}),
    });
  }

  if (product.transportFamily === "local-http") {
    const endpoint = product.configuration.endpoints[0];
    return ClientConfigurationSummarySchema.parse({
      ...base,
      transportFamily: product.transportFamily,
      endpoint: endpoint.endpoint,
      authentication: "none",
      ...(productId === "local-openai" ? { presetId: endpoint.id } : {}),
    });
  }

  return ClientConfigurationSummarySchema.parse({
    ...base,
    transportFamily: product.transportFamily,
    installationId: `${productId}-installation`,
  });
}

function readySourceFor(productId: RunnableProductId): ClientMetadataSource {
  const configuration = readyConfigurationFor(productId);
  const notice = PRODUCT_REGISTRY[productId].notice;
  return {
    productId,
    configuration,
    readiness: ReadinessSchema.parse({
      status: "ready",
      ready: true,
      evidenceStatus: "passed",
      checkedAt: "2026-07-31T12:00:00.000Z",
      acknowledgement: {
        status: "accepted",
        noticeId: notice.id,
        noticeVersion: notice.noticeVersion,
        acceptedAt: "2026-07-31T11:00:00.000Z",
      },
      ...READINESS_PRESENTATION.ready,
    }),
    notices: configuration.notices,
    actions: [...configuration.availableActions],
  };
}

const CONFIGURATIONS = [
  {
    configurationId: "hosted-1",
    revision: 1,
    status: "supported",
    transportFamily: "hosted-api",
    productId: "qwen",
    endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    region: "international",
    workspace: "workspace-reference",
    selectedModelId: "qwen3-coder-flash",
    notices: [copyNotice(PRODUCT_REGISTRY.qwen.notice)],
    availableActions: ["inspect", "select", "test", "update", "delete"],
  },
  {
    configurationId: "http-1",
    revision: 1,
    status: "supported",
    transportFamily: "local-http",
    productId: "local-openai",
    endpoint: "http://127.0.0.1:1234/v1",
    authentication: "none",
    presetId: "lm-studio",
    selectedModelId: "local-model",
    notices: [copyNotice(PRODUCT_REGISTRY["local-openai"].notice)],
    availableActions: ["inspect", "select", "test", "update", "delete"],
  },
  {
    configurationId: "cli-1",
    revision: 1,
    status: "supported",
    transportFamily: "local-cli",
    productId: "codex-cli",
    installationId: "codex-installation-1",
    selectedModelId: "gpt-5",
    notices: [copyNotice(PRODUCT_REGISTRY["codex-cli"].notice)],
    availableActions: ["inspect", "select", "test", "update", "delete"],
  },
  {
    configurationId: "removed-1",
    revision: 1,
    status: "removed",
    transportFamily: "hosted-api",
    productId: "zai-coding",
    selectedModelId: null,
    notices: [],
    availableActions: ["inspect", "delete"],
  },
] as const satisfies readonly ClientConfigurationSummary[];

function serializedKeys(value: unknown) {
  return Object.keys(JSON.parse(JSON.stringify(value))).sort();
}

describe("client metadata projection", () => {
  it("snapshots only allowlisted keys for products, configurations, readiness, notices, and actions", () => {
    const payloads = CONFIGURATIONS.map((configuration) =>
      projectClientMetadata(sourceForConfiguration(configuration)),
    );
    const hostedPayload = projectClientMetadata(sourceForConfiguration(CONFIGURATIONS[0]));
    const removedPayload = projectClientMetadata(sourceForConfiguration(CONFIGURATIONS[3]));
    const [projectedNotice] = hostedPayload.notices;

    expect(projectedNotice).toBeDefined();

    expect(serializedKeys(hostedPayload)).toEqual([
      "actions",
      "configuration",
      "notices",
      "product",
      "readiness",
    ]);
    expect(serializedKeys(hostedPayload.product)).toEqual([
      "billing",
      "description",
      "endpoints",
      "modelPolicy",
      "name",
      "notice",
      "productId",
      "selectable",
      "setupFields",
      "setupLabel",
      "status",
      "transportFamily",
    ]);
    expect(serializedKeys(removedPayload.product)).toEqual([
      "description",
      "migrationActions",
      "name",
      "productId",
      "replacementProductId",
      "selectable",
      "status",
      "transportFamily",
    ]);
    expect(payloads.map((payload) => serializedKeys(payload.configuration))).toEqual([
      [
        "availableActions",
        "configurationId",
        "endpoint",
        "notices",
        "productId",
        "region",
        "revision",
        "selectedModelId",
        "status",
        "transportFamily",
        "workspace",
      ],
      [
        "authentication",
        "availableActions",
        "configurationId",
        "endpoint",
        "notices",
        "presetId",
        "productId",
        "revision",
        "selectedModelId",
        "status",
        "transportFamily",
      ],
      [
        "availableActions",
        "configurationId",
        "installationId",
        "notices",
        "productId",
        "revision",
        "selectedModelId",
        "status",
        "transportFamily",
      ],
      [
        "availableActions",
        "configurationId",
        "notices",
        "productId",
        "revision",
        "selectedModelId",
        "status",
        "transportFamily",
      ],
    ]);
    expect(serializedKeys(hostedPayload.readiness)).toEqual([
      "acknowledgement",
      "action",
      "checkedAt",
      "evidenceStatus",
      "explanation",
      "ready",
      "remediation",
      "status",
    ]);
    expect(serializedKeys(projectedNotice)).toEqual([
      "acknowledgeBefore",
      "acknowledgement",
      "billing",
      "id",
      "noticeVersion",
      "privacy",
      "renewAcknowledgementOn",
    ]);
    expect(hostedPayload.actions).toEqual(["inspect", "select", "test", "update", "delete"]);
  });

  it.each([
    ["literal secret", "literalSecret", "literal-secret-sentinel"],
    ["environment name", "environmentName", "SECRET_ENV_NAME_SENTINEL"],
    ["environment value", "environmentValue", "environment-value-sentinel"],
    ["local bearer token", "localBearerToken", "bearer-token-sentinel"],
    ["account secret identifier", "accountSecretId", "account-secret-id-sentinel"],
    ["workspace secret identifier", "workspaceSecretId", "workspace-secret-id-sentinel"],
    ["authentication path", "authPath", "/home/sentinel/.vendor/auth.json"],
    ["executable path", "executablePath", "/usr/local/bin/sentinel"],
    ["argument vector", "argv", ["--secret-sentinel"]],
    ["raw evidence", "rawEvidence", { response: "raw-evidence-sentinel" }],
  ])("rejects the server-only %s from a client payload", (_label, field, value) => {
    const safePayload = projectClientMetadata(sourceForConfiguration(CONFIGURATIONS[0]));
    const safeConfiguration = safePayload.configuration;
    const [safeNotice] = safePayload.notices;

    expect(safeConfiguration).not.toBeNull();
    expect(safeNotice).toBeDefined();

    for (const unsafePayload of [
      { ...safePayload, [field]: value },
      { ...safePayload, product: { ...safePayload.product, [field]: value } },
      { ...safePayload, configuration: { ...safeConfiguration, [field]: value } },
      { ...safePayload, readiness: { ...safePayload.readiness, [field]: value } },
      { ...safePayload, notices: [{ ...safeNotice, [field]: value }] },
    ]) {
      expect(ClientMetadataPayloadSchema.safeParse(unsafePayload).success).toBe(false);
    }

    const sourceWithServerField = {
      ...sourceForConfiguration(CONFIGURATIONS[0]),
      [field]: value,
      configuration: { ...CONFIGURATIONS[0], [field]: value },
      readiness: { ...readiness("unsupported", "qwen"), [field]: value },
      notices: CONFIGURATIONS[0].notices.map((notice) => ({ ...notice, [field]: value })),
    };
    expect(
      JSON.stringify(projectClientMetadata(sourceWithServerField)).toLowerCase(),
    ).not.toContain("sentinel");
  });

  it("rejects contradictory product, configuration, readiness, and action claims", () => {
    const configured = projectClientMetadata(sourceForConfiguration(CONFIGURATIONS[0]));
    const otherProduct = projectClientMetadata(sourceForConfiguration(CONFIGURATIONS[1])).product;
    const unconfigured = projectClientMetadata({
      productId: "qwen",
      configuration: null,
      readiness: readiness("unconfigured", "qwen"),
      notices: [PRODUCT_REGISTRY.qwen.notice],
      actions: ["create"],
    });

    for (const contradictoryPayload of [
      {
        ...configured,
        product: { ...configured.product, transportFamily: "local-http" },
      },
      { ...configured, product: otherProduct },
      {
        ...configured,
        configuration: CONFIGURATIONS[1],
        notices: CONFIGURATIONS[1].notices,
        actions: [...CONFIGURATIONS[1].availableActions],
      },
      { ...configured, readiness: readiness("unconfigured", "qwen") },
      { ...configured, actions: ["inspect", "delete"] },
      {
        ...configured,
        configuration: { ...configured.configuration, availableActions: ["inspect"] },
        actions: ["inspect"],
      },
      { ...unconfigured, actions: ["create", "select"] },
    ]) {
      expect(ClientMetadataPayloadSchema.safeParse(contradictoryPayload).success).toBe(false);
    }
  });

  it("binds projected configurations to the canonical product endpoint tuples", () => {
    const forgedHosted = {
      ...CONFIGURATIONS[0],
      endpoint: "https://api.groq.com/openai/v1",
    };
    expect(ClientConfigurationSummarySchema.safeParse(forgedHosted).success).toBe(false);

    expect(
      ClientConfigurationSummarySchema.safeParse({
        ...CONFIGURATIONS[0],
        workspace: undefined,
      }).success,
    ).toBe(false);

    expect(
      ClientConfigurationSummarySchema.safeParse({
        ...CONFIGURATIONS[0],
        productId: "gemini",
        endpoint: "https://generativelanguage.googleapis.com/v1beta",
        region: undefined,
        workspace: "workspace-reference",
      }).success,
    ).toBe(false);

    const forgedPreset = {
      ...CONFIGURATIONS[1],
      endpoint: "http://127.0.0.1:8080/v1",
    };
    expect(ClientConfigurationSummarySchema.safeParse(forgedPreset).success).toBe(false);

    const forgedOllamaPreset = {
      ...CONFIGURATIONS[1],
      productId: "ollama",
      presetId: "lm-studio",
    };
    expect(ClientConfigurationSummarySchema.safeParse(forgedOllamaPreset).success).toBe(false);

    const customLoopback = ClientConfigurationSummarySchema.parse({
      ...CONFIGURATIONS[1],
      endpoint: "http://127.0.0.1:4321/v1",
      presetId: undefined,
    });
    expect(projectClientMetadata(sourceForConfiguration(customLoopback)).configuration).toEqual(
      expect.objectContaining({ endpoint: "http://127.0.0.1:4321/v1", presetId: undefined }),
    );
  });

  it("keeps terminal and Unicode line controls out of client-safe projections", () => {
    const payload = projectClientMetadata(sourceForConfiguration(CONFIGURATIONS[0]));
    const configuration = payload.configuration;
    const [notice] = payload.notices;

    expect(configuration).not.toBeNull();
    expect(notice).toBeDefined();
    if (!configuration || !notice) throw new Error("Expected a configured payload");

    for (const controlCharacter of ["\u001b", "\u009b", "\u2028", "\u2029"]) {
      expect(
        ClientMetadataPayloadSchema.safeParse({
          ...payload,
          configuration: {
            ...configuration,
            workspace: `workspace${controlCharacter}reference`,
          },
        }).success,
      ).toBe(false);

      expect(
        ClientMetadataPayloadSchema.safeParse({
          ...payload,
          notices: [{ ...notice, privacy: [`safe${controlCharacter}notice`] }],
        }).success,
      ).toBe(false);
    }
  });

  it("preserves Qwen higher-cost gating as a safe client policy marker", () => {
    const qwen = projectClientProduct("qwen");

    if (qwen.status !== "supported" || qwen.modelPolicy.kind !== "discovered-allowlist") {
      throw new Error("Expected Qwen to expose an allowlist client policy");
    }

    expect(qwen.modelPolicy.higherCostModelEvidence).toEqual({
      outputLimit: "required",
      reviewConformance: "required",
    });

    const { higherCostModelEvidence: _missingMarker, ...withoutMarker } = qwen.modelPolicy;
    expect(
      ClientProductMetadataSchema.safeParse({
        ...qwen,
        modelPolicy: withoutMarker,
      }).success,
    ).toBe(false);

    expect(
      ClientProductMetadataSchema.safeParse({
        ...qwen,
        modelPolicy: {
          ...qwen.modelPolicy,
          higherCostModelEvidence: {
            outputLimit: 8192,
            reviewConformance: "passed",
          },
        },
      }).success,
    ).toBe(false);
  });

  it("requires ready metadata to bind exact model, evidence, and notice for every runnable product", () => {
    for (const productId of RUNNABLE_PRODUCT_IDS) {
      const payload = projectClientMetadata(readySourceFor(productId));
      const configuration = payload.configuration;
      const product = PRODUCT_REGISTRY[productId];

      expect(configuration).not.toBeNull();
      expect(payload.readiness).toMatchObject({
        status: "ready",
        ready: true,
        evidenceStatus: "passed",
      });

      if (!configuration) throw new Error("Expected a configured runnable product");

      expect(
        ClientMetadataPayloadSchema.safeParse({
          ...payload,
          configuration: { ...configuration, selectedModelId: null },
        }).success,
      ).toBe(false);

      const forgedModelId =
        product.modelPolicy.kind === "discovered-exact" ||
        product.modelPolicy.kind === "pinned-downstream-route"
          ? "latest"
          : "forged-model";
      expect(
        ClientMetadataPayloadSchema.safeParse({
          ...payload,
          configuration: { ...configuration, selectedModelId: forgedModelId },
        }).success,
      ).toBe(false);

      const wrongNotice = PRODUCT_REGISTRY[productId === "gemini" ? "zai" : "gemini"].notice;
      expect(
        ClientMetadataPayloadSchema.safeParse({
          ...payload,
          readiness: {
            ...payload.readiness,
            acknowledgement: {
              ...payload.readiness.acknowledgement,
              noticeId: wrongNotice.id,
            },
          },
        }).success,
      ).toBe(false);
      expect(
        ClientMetadataPayloadSchema.safeParse({
          ...payload,
          readiness: {
            ...payload.readiness,
            acknowledgement: {
              ...payload.readiness.acknowledgement,
              noticeVersion: product.notice.noticeVersion + 1,
            },
          },
        }).success,
      ).toBe(false);

      expect(
        ClientMetadataPayloadSchema.safeParse({
          ...payload,
          readiness: { ...payload.readiness, checkedAt: null },
        }).success,
      ).toBe(false);
      expect(
        ClientMetadataPayloadSchema.safeParse({
          ...payload,
          readiness: { ...payload.readiness, evidenceStatus: "failed" },
        }).success,
      ).toBe(false);
    }
  });

  it("fails closed for opt-in, higher-cost, and unpinned route models at the client boundary", () => {
    const zai = projectClientMetadata(readySourceFor("zai"));
    expect(
      ClientMetadataPayloadSchema.safeParse({
        ...zai,
        configuration: { ...zai.configuration, selectedModelId: "glm-4.7-flash" },
      }).success,
    ).toBe(false);

    const qwen = projectClientMetadata(readySourceFor("qwen"));
    expect(
      ClientMetadataPayloadSchema.safeParse({
        ...qwen,
        configuration: { ...qwen.configuration, selectedModelId: "qwen3-coder-plus" },
      }).success,
    ).toBe(false);

    const openrouter = projectClientMetadata(readySourceFor("openrouter"));
    for (const selectedModelId of [
      "gpt-4.1-mini",
      "openrouter/auto",
      "openrouter/gpt-4.1",
      "openrouter/anthropic/claude-3.7-sonnet",
      "provider/automatic",
      "openai/gpt-4.1-mini:free",
      "openai/gpt-4.1-mini:online",
      "openai/gpt-4.1-mini/thinking",
    ]) {
      expect(
        ClientMetadataPayloadSchema.safeParse({
          ...openrouter,
          configuration: { ...openrouter.configuration, selectedModelId },
        }).success,
        selectedModelId,
      ).toBe(false);
    }

    expect(
      ClientMetadataPayloadSchema.safeParse({
        ...openrouter,
        configuration: {
          ...openrouter.configuration,
          selectedModelId: "anthropic/claude-3.7-sonnet",
        },
      }).success,
    ).toBe(true);
  });

  it.each([
    "acknowledgement-required",
    "credential-invalid",
    "conformance-failed",
    "skipped",
  ] as const)("rejects a wrong-product acknowledgement in %s readiness", (status) => {
    const payload = projectClientMetadata({
      productId: "qwen",
      configuration: CONFIGURATIONS[0],
      readiness: readiness(status, "qwen"),
      notices: CONFIGURATIONS[0].notices,
      actions: [...CONFIGURATIONS[0].availableActions],
    });
    const wrongNotice = PRODUCT_REGISTRY.gemini.notice;
    const acknowledgement = payload.readiness.acknowledgement;

    expect(acknowledgement.status).not.toBe("not-applicable");
    expect(
      ClientMetadataPayloadSchema.safeParse({
        ...payload,
        readiness: {
          ...payload.readiness,
          acknowledgement: {
            ...acknowledgement,
            noticeId: wrongNotice.id,
            noticeVersion: wrongNotice.noticeVersion,
          },
        },
      }).success,
    ).toBe(false);
  });

  it("preserves an accepted current notice on a non-ready state and rejects stale acceptance", () => {
    const product = PRODUCT_REGISTRY.qwen;
    const acceptedReadiness = ReadinessSchema.parse({
      ...readiness("skipped", "qwen"),
      acknowledgement: {
        status: "accepted",
        noticeId: product.notice.id,
        noticeVersion: product.notice.noticeVersion,
        acceptedAt: "2026-07-31T11:00:00.000Z",
      },
    });
    const payload = projectClientMetadata({
      productId: "qwen",
      configuration: CONFIGURATIONS[0],
      readiness: acceptedReadiness,
      notices: CONFIGURATIONS[0].notices,
      actions: [...CONFIGURATIONS[0].availableActions],
    });

    expect(payload.readiness.acknowledgement).toEqual({
      status: "accepted",
      noticeId: product.notice.id,
      noticeVersion: product.notice.noticeVersion,
      acceptedAt: "2026-07-31T11:00:00.000Z",
    });

    expect(
      ClientMetadataPayloadSchema.safeParse({
        ...payload,
        readiness: {
          ...payload.readiness,
          acknowledgement: {
            ...payload.readiness.acknowledgement,
            noticeId: PRODUCT_REGISTRY.gemini.notice.id,
          },
        },
      }).success,
    ).toBe(false);
  });

  it("keeps unsupported acknowledgement non-applicable and rejects injected terms", () => {
    const payload = projectClientMetadata(sourceForConfiguration(CONFIGURATIONS[0]));
    const wrongAcknowledgement = {
      status: "accepted" as const,
      noticeId: PRODUCT_REGISTRY.gemini.notice.id,
      noticeVersion: PRODUCT_REGISTRY.gemini.notice.noticeVersion,
      acceptedAt: "2026-07-31T11:00:00.000Z",
    };
    const unsupported = {
      ...payload,
      readiness: readiness("unsupported", "qwen"),
    };

    expect(unsupported.readiness.acknowledgement).toEqual({ status: "not-applicable" });
    expect(
      ClientMetadataPayloadSchema.safeParse({
        ...unsupported,
        readiness: { ...unsupported.readiness, acknowledgement: wrongAcknowledgement },
      }).success,
    ).toBe(false);
  });

  it("rejects ready claims for the removed product and preserves its migration contract", () => {
    const removedPayload = projectClientMetadata(sourceForConfiguration(CONFIGURATIONS[3]));

    expect(
      ClientMetadataPayloadSchema.safeParse({
        ...removedPayload,
        readiness: {
          status: "ready",
          ready: true,
          evidenceStatus: "passed",
          checkedAt: "2026-07-31T12:00:00.000Z",
          acknowledgement: {
            status: "accepted",
            noticeId: PRODUCT_REGISTRY.zai.notice.id,
            noticeVersion: PRODUCT_REGISTRY.zai.notice.noticeVersion,
            acceptedAt: "2026-07-31T11:00:00.000Z",
          },
          ...READINESS_PRESENTATION.ready,
        },
      }).success,
    ).toBe(false);
    expect(removedPayload.product).toMatchObject({
      productId: "zai-coding",
      status: "removed",
      selectable: false,
    });
    expect(removedPayload.configuration?.selectedModelId).toBeNull();
    expect(removedPayload.readiness.status).toBe("removed");
    expect(removedPayload.actions).toEqual(["inspect", "delete"]);
  });

  it("rejects secret-bearing values even when their fields are allowlisted", () => {
    const safePayload = projectClientMetadata(sourceForConfiguration(CONFIGURATIONS[0]));
    const safeConfiguration = safePayload.configuration;
    const [safeNotice] = safePayload.notices;

    expect(safeConfiguration).not.toBeNull();
    expect(safeNotice).toBeDefined();

    for (const secretBearingValue of [
      "literal-secret-sentinel",
      "DIFFGAZER_QWEN_API_KEY",
      "environment-value-sentinel",
      "Bearer abcdefgh12345678",
      "sk-proj_abcdefgh12345678",
      "/home/person/.config/provider/auth.json",
      "workspace:workspace-1234",
    ]) {
      const unsafeNotice = { ...safeNotice, privacy: [secretBearingValue] };
      expect(
        ClientMetadataPayloadSchema.safeParse({
          ...safePayload,
          configuration: { ...safeConfiguration, notices: [unsafeNotice] },
          notices: [unsafeNotice],
        }).success,
      ).toBe(false);
    }

    const secretNotice = {
      ...CONFIGURATIONS[0].notices[0],
      privacy: ["Bearer abcdefgh12345678"],
    };
    const secretConfiguration = {
      ...CONFIGURATIONS[0],
      notices: [secretNotice],
    } satisfies ClientConfigurationSummary;
    expect(() => projectClientMetadata(sourceForConfiguration(secretConfiguration))).toThrow(
      "Notice text must not contain secret or private-path material",
    );
  });

  it("accepts opaque configuration and model IDs without classifying their text", () => {
    const safePayload = projectClientMetadata(sourceForConfiguration(CONFIGURATIONS[1]));

    expect(
      ClientMetadataPayloadSchema.safeParse({
        ...safePayload,
        configuration: {
          ...safePayload.configuration,
          configurationId: "account-1234",
          selectedModelId: "workspace-2026",
        },
      }).success,
    ).toBe(true);
  });

  it("rejects readiness states belonging to another transport family", () => {
    const hostedPayload = projectClientMetadata(sourceForConfiguration(CONFIGURATIONS[0]));
    const cliPayload = projectClientMetadata(sourceForConfiguration(CONFIGURATIONS[2]));

    for (const status of [
      "local-api-incompatible",
      "local-selected-model-missing",
      "local-cancellation-failed",
    ] as const) {
      expect(
        ClientMetadataPayloadSchema.safeParse({
          ...hostedPayload,
          readiness: readiness(status, "qwen"),
        }).success,
      ).toBe(false);
    }

    expect(
      ClientMetadataPayloadSchema.safeParse({
        ...cliPayload,
        readiness: readiness("local-api-incompatible", "codex-cli"),
      }).success,
    ).toBe(false);
    expect(
      ClientMetadataPayloadSchema.safeParse({
        ...cliPayload,
        readiness: readiness("local-cancellation-failed", "codex-cli"),
      }).success,
    ).toBe(true);
  });

  it("keeps removed records on their non-runnable state and action contract", () => {
    const removedPayload = projectClientMetadata(sourceForConfiguration(CONFIGURATIONS[3]));

    for (const actions of [
      ["create"],
      ["select"],
      ["test"],
      ["update"],
      ["inspect", "delete", "test"],
    ]) {
      expect(ClientMetadataPayloadSchema.safeParse({ ...removedPayload, actions }).success).toBe(
        false,
      );
    }

    expect(
      ClientMetadataPayloadSchema.safeParse({
        ...removedPayload,
        readiness: readiness("unsupported", "qwen"),
      }).success,
    ).toBe(false);
    expect(
      ClientMetadataPayloadSchema.safeParse({
        ...removedPayload,
        configuration: null,
      }).success,
    ).toBe(false);
    expect(
      ClientMetadataPayloadSchema.safeParse({
        ...removedPayload,
        configuration: { ...removedPayload.configuration, availableActions: ["inspect"] },
        actions: ["inspect"],
      }).success,
    ).toBe(false);
  });

  it("keeps Web and Ink projection copy identical for all 13 products and removed records", () => {
    const sources: ClientMetadataSource[] = RUNNABLE_PRODUCT_IDS.map((productId) => ({
      productId,
      configuration: null,
      readiness: readiness("unconfigured", productId),
      notices: [PRODUCT_REGISTRY[productId].notice],
      actions: ["create"],
    }));
    sources.push(sourceForConfiguration(CONFIGURATIONS[3]));

    const webPayloads = sources.map(projectClientMetadata);
    const inkPayloads = sources.map(projectClientMetadata);

    expect(webPayloads).toEqual(inkPayloads);
    expect(
      webPayloads.slice(0, RUNNABLE_PRODUCT_IDS.length).map(({ product }) => product.productId),
    ).toEqual(RUNNABLE_PRODUCT_IDS);
    expect(
      webPayloads.slice(RUNNABLE_PRODUCT_IDS.length).map(({ product }) => product.productId),
    ).toEqual(REMOVED_PRODUCT_IDS);
    expect(webPayloads.map(({ product }) => product.name)).toEqual(
      inkPayloads.map(({ product }) => product.name),
    );
  });
});
