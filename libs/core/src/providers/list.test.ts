import { describe, expect, it } from "vitest";
import type { ConfigurationStatus } from "../schemas/config/configuration-status.js";
import type {
  ClientConfigurationNotice,
  ClientConfigurationSummary,
} from "../schemas/config/provider-config.js";
import { SELECTABLE_PRODUCTS } from "../schemas/config/provider-registry.js";
import { REMOVED_PRODUCT_ID } from "../schemas/config/providers.js";
import {
  READINESS_PRESENTATION,
  type Readiness,
  ReadinessSchema,
} from "../schemas/config/readiness.js";
import { mapProviderList } from "./list.js";
import { PRODUCT_REGISTRY } from "./product-registry.js";

const CHECKED_AT = "2026-07-31T10:00:00.000Z";
const HOSTED_ENDPOINTS = {
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  zai: "https://api.z.ai/api/paas/v4",
  groq: "https://api.groq.com/openai/v1",
} as const;

type TestedReadinessStatus = "ready" | "unreachable" | "unsupported" | "removed";

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

  if (status === "unreachable") {
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

function copyNotice(productId: "gemini" | "zai" | "groq"): ClientConfigurationNotice {
  const notice = PRODUCT_REGISTRY[productId].notice;
  return { ...notice, billing: [...notice.billing], privacy: [...notice.privacy] };
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
    notices: [copyNotice(productId)],
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
    "unreachable",
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

  it("appends removed records without making them selectable", () => {
    const removedConfiguration: ClientConfigurationSummary = {
      configurationId: "legacy-removed-zai-plan",
      revision: 4,
      status: "removed",
      transportFamily: "hosted-api",
      productId: REMOVED_PRODUCT_ID,
      selectedModelId: null,
      notices: [],
      availableActions: ["inspect", "delete"],
    };
    const rows = mapProviderList([status(removedConfiguration, readiness("removed"))]);
    const row = rows.find(
      ({ configuration }) => configuration?.configurationId === "legacy-removed-zai-plan",
    );

    expect(row).toMatchObject({
      product: { productId: REMOVED_PRODUCT_ID, status: "removed", selectable: false },
      readiness: { status: "removed", ready: false, action: "delete" },
      notices: [],
      actions: ["inspect", "delete"],
    });
    expect(rows).toHaveLength(14);
  });

  it("derives exactly the 13 selectable products from the product registry", () => {
    const selectableRows = mapProviderList([]).filter(({ product }) => product.selectable);

    expect(selectableRows.map(({ product }) => product.productId)).toEqual(
      SELECTABLE_PRODUCTS.map(({ productId }) => productId),
    );
    expect(selectableRows).toHaveLength(13);
  });

  it("does not serialize the legacy key-presence field", () => {
    const legacyField = ["has", "Api", "Key"].join("");
    const rows = mapProviderList([
      status(hostedConfiguration("zai-unreachable", "zai"), readiness("unreachable")),
    ]);

    expect(JSON.stringify(rows)).not.toContain(legacyField);
  });
});
