import { describe, expect, it } from "vitest";
import {
  type ClientConfigurationSummary,
  ClientConfigurationSummarySchema,
} from "../schemas/config/provider-config.js";
import { READINESS_PRESENTATION, ReadinessSchema } from "../schemas/config/readiness.js";
import { RUNNABLE_PRODUCT_IDS, type RunnableProductId } from "../schemas/config/transports.js";
import {
  ClientMetadataPayloadSchema,
  type ClientMetadataSource,
  projectClientMetadata,
} from "./client-metadata.js";
import { PRODUCT_REGISTRY, type ProductNotice } from "./product-registry.js";

type TestReadinessStatus =
  | "unconfigured"
  | "credential-invalid"
  | "conformance-failed"
  | "acknowledgement-required"
  | "unsupported"
  | "skipped"
  | "local-conformance-failed";

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
    status === "unsupported"
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
  return {
    productId: configuration.productId,
    configuration,
    readiness: readiness("unsupported", configuration.productId),
    notices: configuration.notices,
    actions: [...configuration.availableActions],
  };
}

function copyNotice(notice: ProductNotice) {
  return { ...notice, billing: [...notice.billing], privacy: [...notice.privacy] };
}

function selectedModelFor(productId: RunnableProductId): string {
  const policy = PRODUCT_REGISTRY[productId].modelPolicy;
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

  const endpoint = product.configuration.endpoints[0];
  return ClientConfigurationSummarySchema.parse({
    ...base,
    transportFamily: product.transportFamily,
    endpoint: endpoint.endpoint,
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
    productId: "zai",
    endpoint: "https://api.z.ai/api/paas/v4",
    selectedModelId: "glm-4.7",
    notices: [copyNotice(PRODUCT_REGISTRY.zai.notice)],
    availableActions: ["inspect", "select", "test", "update", "delete"],
  },
  {
    configurationId: "hosted-2",
    revision: 1,
    status: "supported",
    transportFamily: "hosted-api",
    productId: "gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    selectedModelId: "gemini-2.5-flash",
    notices: [copyNotice(PRODUCT_REGISTRY.gemini.notice)],
    availableActions: ["inspect", "select", "test", "update", "delete"],
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
    const hostedConfigurationKeys = [
      "availableActions",
      "configurationId",
      "endpoint",
      "notices",
      "productId",
      "revision",
      "selectedModelId",
      "status",
      "transportFamily",
    ];
    expect(payloads.map((payload) => serializedKeys(payload.configuration))).toEqual([
      hostedConfigurationKeys,
      hostedConfigurationKeys,
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
      readiness: { ...readiness("unsupported", "zai"), [field]: value },
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
      productId: "zai",
      configuration: null,
      readiness: readiness("unconfigured", "zai"),
      notices: [PRODUCT_REGISTRY.zai.notice],
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
      { ...configured, readiness: readiness("unconfigured", "zai") },
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
      endpoint: "https://generativelanguage.googleapis.com/v1beta",
    };
    expect(ClientConfigurationSummarySchema.safeParse(forgedHosted).success).toBe(false);

    expect(
      ClientConfigurationSummarySchema.safeParse({
        ...CONFIGURATIONS[0],
        productId: "gemini",
        endpoint: "https://api.z.ai/api/paas/v4",
      }).success,
    ).toBe(false);
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
          notices: [{ ...notice, privacy: [`safe${controlCharacter}notice`] }],
        }).success,
      ).toBe(false);
    }
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

      const forgedModelId = "latest";
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

  it("fails closed for unpinned route models at the client boundary", () => {
    const openrouter = projectClientMetadata(readySourceFor("openrouter"));
    for (const selectedModelId of [
      "gpt-4.1-mini",
      "openrouter/auto",
      "openrouter/gpt-4.1",
      "openrouter/anthropic/claude-3.7-sonnet",
      "provider/automatic",
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

    // A pinned variant suffix is part of a downstream identity, not a routing
    // instruction, so the client boundary carries it like any other exact pair.
    for (const selectedModelId of [
      "anthropic/claude-3.7-sonnet",
      "openai/gpt-4.1-mini:free",
      "openai/gpt-4.1-mini:thinking",
    ]) {
      expect(
        ClientMetadataPayloadSchema.safeParse({
          ...openrouter,
          configuration: { ...openrouter.configuration, selectedModelId },
        }).success,
        selectedModelId,
      ).toBe(true);
    }
  });

  it.each([
    "acknowledgement-required",
    "credential-invalid",
    "conformance-failed",
    "skipped",
  ] as const)("rejects a wrong-product acknowledgement in %s readiness", (status) => {
    const payload = projectClientMetadata({
      productId: "zai",
      configuration: CONFIGURATIONS[0],
      readiness: readiness(status, "zai"),
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
    const product = PRODUCT_REGISTRY.zai;
    const acceptedReadiness = ReadinessSchema.parse({
      ...readiness("skipped", "zai"),
      acknowledgement: {
        status: "accepted",
        noticeId: product.notice.id,
        noticeVersion: product.notice.noticeVersion,
        acceptedAt: "2026-07-31T11:00:00.000Z",
      },
    });
    const payload = projectClientMetadata({
      productId: "zai",
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
      readiness: readiness("unsupported", "zai"),
    };

    expect(unsupported.readiness.acknowledgement).toEqual({ status: "not-applicable" });
    expect(
      ClientMetadataPayloadSchema.safeParse({
        ...unsupported,
        readiness: { ...unsupported.readiness, acknowledgement: wrongAcknowledgement },
      }).success,
    ).toBe(false);
  });

  it("rejects secret-bearing values even when their fields are allowlisted", () => {
    const safePayload = projectClientMetadata(sourceForConfiguration(CONFIGURATIONS[0]));
    const safeConfiguration = safePayload.configuration;
    const [safeNotice] = safePayload.notices;

    expect(safeConfiguration).not.toBeNull();
    expect(safeNotice).toBeDefined();

    for (const secretBearingValue of [
      "literal-secret-sentinel",
      "DIFFGAZER_ZAI_API_KEY",
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

  it("rejects local readiness states on a hosted configuration", () => {
    const hostedPayload = projectClientMetadata(sourceForConfiguration(CONFIGURATIONS[0]));

    expect(
      ClientMetadataPayloadSchema.safeParse({
        ...hostedPayload,
        readiness: readiness("local-conformance-failed", "zai"),
      }).success,
    ).toBe(false);
    expect(
      ClientMetadataPayloadSchema.safeParse({
        ...hostedPayload,
        readiness: readiness("conformance-failed", "zai"),
      }).success,
    ).toBe(true);
  });

  it("projects every runnable product with its registry presentation copy", () => {
    const sources: ClientMetadataSource[] = RUNNABLE_PRODUCT_IDS.map((productId) => ({
      productId,
      configuration: null,
      readiness: readiness("unconfigured", productId),
      notices: [PRODUCT_REGISTRY[productId].notice],
      actions: ["create"],
    }));

    const payloads = sources.map(projectClientMetadata);

    expect(
      payloads.map(({ product }) => ({
        productId: product.productId,
        transportFamily: product.transportFamily,
        name: product.name,
        description: product.description,
        setupLabel: product.setupLabel,
        setupFields: product.setupFields,
        modelPolicyKind: product.modelPolicy.kind,
        billing: product.billing,
        noticeId: product.notice.id,
        noticeVersion: product.notice.noticeVersion,
      })),
    ).toEqual(
      RUNNABLE_PRODUCT_IDS.map((productId) => {
        const registered = PRODUCT_REGISTRY[productId];
        return {
          productId,
          transportFamily: registered.transportFamily,
          name: registered.presentation.name,
          description: registered.presentation.description,
          setupLabel: registered.presentation.setupLabel,
          setupFields: [...registered.configuration.fields],
          modelPolicyKind: registered.modelPolicy.kind,
          billing: {
            modes: [...registered.billing.modes],
            posture: registered.billing.posture,
          },
          noticeId: registered.notice.id,
          noticeVersion: registered.notice.noticeVersion,
        };
      }),
    );
  });
});
