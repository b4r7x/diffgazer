import { describe, expect, it } from "vitest";
import type { ConfigurationStatus } from "../schemas/config/configuration-status.js";
import { LEGACY_V1_HAS_API_KEY_PROPERTY } from "../schemas/config/legacy-provider-config.js";
import type { ClientConfigurationSummary } from "../schemas/config/provider-config.js";
import {
  READINESS_PRESENTATION,
  type Readiness,
  ReadinessSchema,
} from "../schemas/config/readiness.js";
import { configurationStatus, makeClientNotice } from "../testing/provider-fixtures.js";
import {
  findProviderById,
  findProviderDialogRow,
  getProviderRowId,
  mapProviderList,
} from "./list.js";
import { PRODUCT_REGISTRY } from "./product-registry.js";
import { SELECTABLE_PRODUCTS } from "./selectable-products.js";

const CHECKED_AT = "2026-07-31T10:00:00.000Z";
const HOSTED_ENDPOINTS = {
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  zai: "https://api.z.ai/api/paas/v4",
  groq: "https://api.groq.com/openai/v1",
} as const;

type TestedReadinessStatus = "ready" | "conformance-failed" | "unsupported";

function readiness(status: TestedReadinessStatus): Readiness {
  const presentation = READINESS_PRESENTATION[status];

  if (status === "ready") {
    return ReadinessSchema.parse({
      status,
      ready: true,
      evidenceStatus: "passed",
      checkedAt: CHECKED_AT,
      acknowledgement: {
        status: "accepted",
        noticeId: PRODUCT_REGISTRY.gemini.notice.id,
        noticeVersion: PRODUCT_REGISTRY.gemini.notice.noticeVersion,
        acceptedAt: CHECKED_AT,
      },
      ...presentation,
    });
  }

  if (status === "conformance-failed") {
    return ReadinessSchema.parse({
      status,
      ready: false,
      evidenceStatus: "failed",
      checkedAt: CHECKED_AT,
      acknowledgement: { status: "not-applicable" },
      ...presentation,
    });
  }

  return ReadinessSchema.parse({
    status,
    ready: false,
    evidenceStatus: "not-checked",
    checkedAt: null,
    acknowledgement: { status: "not-applicable" },
    ...presentation,
  });
}

function hostedConfiguration(
  configurationId: string,
  productId: "gemini" | "zai" | "groq",
): ClientConfigurationSummary {
  return {
    configurationId,
    revision: 1,
    status: "supported",
    transportFamily: "hosted-api",
    productId,
    endpoint: HOSTED_ENDPOINTS[productId],
    selectedModelId: productId === "gemini" ? "gemini-2.5-flash" : null,
    notices: [makeClientNotice(productId)],
    availableActions: ["inspect", "select", "test", "update", "delete"],
  };
}

function status(
  configuration: ClientConfigurationSummary,
  currentReadiness: Readiness,
): ConfigurationStatus {
  return { configuration, readiness: currentReadiness };
}

describe("mapProviderList", () => {
  it("maps a ready configuration with its safe summary and actions", () => {
    const rows = mapProviderList([
      status(hostedConfiguration("gemini-primary", "gemini"), readiness("ready")),
    ]);
    const row = rows.find(
      ({ configuration }) => configuration?.configurationId === "gemini-primary",
    );

    expect(row).toMatchObject({
      product: { productId: "gemini", selectable: true },
      configuration: {
        configurationId: "gemini-primary",
        selectedModelId: "gemini-2.5-flash",
      },
      readiness: { status: "ready", ready: true },
      actions: ["inspect", "select", "test", "update", "delete"],
    });
  });

  it("maps products without configurations as unconfigured create rows", () => {
    const row = mapProviderList([]).find(({ product }) => product.productId === "local-openai");

    expect(row).toMatchObject({
      product: { productId: "local-openai", transportFamily: "local-http" },
      configuration: null,
      readiness: { status: "unconfigured", ready: false, action: "create" },
      actions: ["create"],
    });
  });

  it.each([
    "conformance-failed",
    "unsupported",
  ] as const)("preserves the %s readiness and remediation", (readinessStatus) => {
    const rows = mapProviderList([
      status(hostedConfiguration(`groq-${readinessStatus}`, "groq"), readiness(readinessStatus)),
    ]);
    const row = rows.find(
      ({ configuration }) => configuration?.configurationId === `groq-${readinessStatus}`,
    );

    expect(row?.readiness).toEqual(readiness(readinessStatus));
    expect(row?.actions).toEqual(["inspect", "select", "test", "update", "delete"]);
  });

  it("derives exactly the 12 selectable products from the product registry", () => {
    const selectableRows = mapProviderList([]).filter(({ product }) => product.selectable);

    expect(selectableRows.map(({ product }) => product.productId)).toEqual(
      SELECTABLE_PRODUCTS.map(({ productId }) => productId),
    );
    expect(selectableRows).toHaveLength(12);
  });

  it("does not serialize the legacy key-presence field", () => {
    const rows = mapProviderList([
      status(hostedConfiguration("zai-conformance-failed", "zai"), readiness("conformance-failed")),
    ]);

    expect(JSON.stringify(rows)).not.toContain(LEGACY_V1_HAS_API_KEY_PROPERTY);
  });
});

describe("findProviderDialogRow", () => {
  const openRouterConfiguration = {
    configurationId: "openrouter-primary",
    revision: 1,
    status: "supported" as const,
    transportFamily: "hosted-api" as const,
    productId: "openrouter" as const,
    endpoint: "https://openrouter.ai/api/v1",
    selectedModelId: null,
    notices: [makeClientNotice("openrouter")],
    availableActions: ["inspect", "select", "test", "update", "delete"],
  } satisfies ClientConfigurationSummary;

  it("resolves a model dialog by configuration id after the row id flips", () => {
    const rows = mapProviderList([configurationStatus(openRouterConfiguration, "model-missing")]);
    const owner = {
      kind: "model" as const,
      rowId: "openrouter",
      configurationId: "openrouter-primary",
    };

    const openRouterRow = rows.find((row) => row.product.productId === "openrouter");
    if (!openRouterRow) throw new Error("Expected OpenRouter row");

    expect(getProviderRowId(openRouterRow)).toBe("openrouter-primary");
    expect(findProviderById(rows, owner.rowId)).toBeNull();
    expect(findProviderDialogRow(rows, owner)?.configuration?.configurationId).toBe(
      "openrouter-primary",
    );
  });

  it("falls back to the pre-create row id when the configuration id is not listed yet", () => {
    const rows = mapProviderList([]);
    const owner = {
      kind: "model" as const,
      rowId: "openrouter",
      configurationId: "openrouter-primary",
    };

    expect(findProviderDialogRow(rows, owner)?.product.productId).toBe("openrouter");
    expect(findProviderDialogRow(rows, owner)?.configuration).toBeNull();
  });
});
