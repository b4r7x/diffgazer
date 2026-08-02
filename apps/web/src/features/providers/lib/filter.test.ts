import {
  findProviderById,
  getProviderRowId,
  mapProviderList,
  PRODUCT_REGISTRY,
  type ProviderListRow,
} from "@diffgazer/core/providers";
import type {
  ClientConfigurationSummary,
  ConfigurationStatus,
  RunnableProductId,
} from "@diffgazer/core/schemas/config";
import {
  LEGACY_V1_HAS_API_KEY_PROPERTY,
  READINESS_PRESENTATION,
  REMOVED_PRODUCT_ID,
  ReadinessSchema,
  SELECTABLE_PRODUCTS,
} from "@diffgazer/core/schemas/config";
import { describe, expect, it } from "vitest";
import { filterProviders, PROVIDER_FILTERS } from "./filter";

function copyNotice(productId: RunnableProductId) {
  const notice = PRODUCT_REGISTRY[productId].notice;
  return { ...notice, billing: [...notice.billing], privacy: [...notice.privacy] };
}

function configurationStatus(
  configuration: ClientConfigurationSummary,
  readinessStatus:
    | "ready"
    | "unconfigured"
    | "unsupported"
    | "local-endpoint-unreachable"
    | "removed",
): ConfigurationStatus {
  const presentation = READINESS_PRESENTATION[readinessStatus];
  const readiness =
    readinessStatus === "ready"
      ? ReadinessSchema.parse({
          status: readinessStatus,
          ready: true,
          evidenceStatus: "passed",
          checkedAt: "2026-07-31T12:00:00.000Z",
          acknowledgement: {
            status: "accepted",
            noticeId: PRODUCT_REGISTRY.gemini.notice.id,
            noticeVersion: PRODUCT_REGISTRY.gemini.notice.noticeVersion,
            acceptedAt: "2026-07-31T12:00:00.000Z",
          },
          ...presentation,
        })
      : ReadinessSchema.parse({
          status: readinessStatus,
          ready: false,
          evidenceStatus:
            readinessStatus === "local-endpoint-unreachable" ? "failed" : "not-checked",
          checkedAt:
            readinessStatus === "local-endpoint-unreachable" ? "2026-07-31T12:00:00.000Z" : null,
          acknowledgement: { status: "not-applicable" },
          ...presentation,
        });

  return { configuration, readiness };
}

const READY_GEMINI = configurationStatus(
  {
    configurationId: "gemini-primary",
    revision: 1,
    status: "supported",
    transportFamily: "hosted-api",
    productId: "gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    selectedModelId: "gemini-2.5-flash",
    notices: [copyNotice("gemini")],
    availableActions: ["inspect", "select", "test", "update", "delete"],
  },
  "ready",
);

const _UNCONFIGURED_ZAI = mapProviderList([]).find(({ product }) => product.productId === "zai");

const LOCAL_UNREACHABLE = configurationStatus(
  {
    configurationId: "local-openai-1",
    revision: 1,
    status: "supported",
    transportFamily: "local-http",
    productId: "local-openai",
    endpoint: "http://127.0.0.1:1234/v1",
    authentication: "none",
    presetId: "lm-studio",
    selectedModelId: null,
    notices: [copyNotice("local-openai")],
    availableActions: ["inspect", "select", "test", "update", "delete"],
  },
  "local-endpoint-unreachable",
);

const CLI_UNSUPPORTED = configurationStatus(
  {
    configurationId: "codex-cli-1",
    revision: 1,
    status: "supported",
    transportFamily: "local-cli",
    productId: "codex-cli",
    installationId: "codex-installation",
    selectedModelId: null,
    notices: [copyNotice("codex-cli")],
    availableActions: ["inspect", "select", "test", "update", "delete"],
  },
  "unsupported",
);

const REMOVED_ZAI_CODING = configurationStatus(
  {
    configurationId: "legacy-removed-zai-plan",
    revision: 4,
    status: "removed",
    transportFamily: "hosted-api",
    productId: REMOVED_PRODUCT_ID,
    selectedModelId: null,
    notices: [],
    availableActions: ["inspect", "delete"],
  },
  "removed",
);

const ALL_ROWS = mapProviderList([
  READY_GEMINI,
  LOCAL_UNREACHABLE,
  CLI_UNSUPPORTED,
  REMOVED_ZAI_CODING,
]);

const rowIds = (rows: ProviderListRow[]) => rows.map(getProviderRowId);

describe("filterProviders", () => {
  it("returns all selectable products plus removed records", () => {
    expect(ALL_ROWS.filter(({ product }) => product.selectable)).toHaveLength(13);
    expect(ALL_ROWS.some(({ product }) => product.productId === REMOVED_PRODUCT_ID)).toBe(true);
  });

  it("returns all providers when filter is 'all'", () => {
    expect(rowIds(filterProviders(ALL_ROWS, "all"))).toEqual(rowIds(ALL_ROWS));
  });

  it("filters to ready configurations", () => {
    expect(rowIds(filterProviders(ALL_ROWS, "configured"))).toEqual(["gemini-primary"]);
  });

  it("filters to providers needing setup", () => {
    const ids = rowIds(filterProviders(ALL_ROWS, "needs-key"));
    expect(ids).toContain("local-openai-1");
    expect(ids).toContain("codex-cli-1");
    expect(ids).not.toContain("gemini-primary");
    expect(ids).not.toContain("legacy-removed-zai-plan");
  });

  it("partitions free vs paid by product billing modes", () => {
    const freeIds = rowIds(filterProviders(ALL_ROWS, "free"));
    expect(freeIds).toContain("gemini-primary");
    expect(freeIds).not.toContain("legacy-removed-zai-plan");

    const paidIds = rowIds(filterProviders(ALL_ROWS, "paid"));
    expect(paidIds).not.toContain("gemini-primary");
    expect(paidIds).not.toContain("legacy-removed-zai-plan");
  });

  it("matches search query against product name and id", () => {
    expect(rowIds(filterProviders(ALL_ROWS, "all", "google"))).toEqual(["gemini-primary"]);
    expect(rowIds(filterProviders(ALL_ROWS, "all", "zai"))).toEqual(["zai"]);
  });

  it("does not treat removed REMOVED_PRODUCT_ID as a normal search match", () => {
    expect(rowIds(filterProviders(ALL_ROWS, "all", "coding"))).toEqual([]);
    expect(rowIds(filterProviders(ALL_ROWS, "all", REMOVED_PRODUCT_ID))).toEqual([]);
  });

  it("combines filter and search", () => {
    expect(rowIds(filterProviders(ALL_ROWS, "configured", "gemini"))).toEqual(["gemini-primary"]);
  });

  it("trims whitespace from search query", () => {
    expect(rowIds(filterProviders(ALL_ROWS, "all", "  gemini  "))).toEqual(["gemini-primary"]);
  });

  it("exposes the canonical PROVIDER_FILTERS tuple", () => {
    expect(PROVIDER_FILTERS).toEqual(["all", "configured", "needs-key", "free", "paid"]);
  });

  it("preserves removed records with inspect and delete actions only", () => {
    const removed = findProviderById(ALL_ROWS, "legacy-removed-zai-plan");
    expect(removed?.actions).toEqual(["inspect", "delete"]);
    expect(removed?.product.selectable).toBe(false);
  });

  it("distinguishes local unreachable and CLI unsupported readiness", () => {
    const local = findProviderById(ALL_ROWS, "local-openai-1");
    const cli = findProviderById(ALL_ROWS, "codex-cli-1");

    expect(local?.readiness.status).toBe("local-endpoint-unreachable");
    expect(cli?.readiness.status).toBe("unsupported");
    expect(local?.product.transportFamily).toBe("local-http");
    expect(cli?.product.transportFamily).toBe("local-cli");
  });

  it("resolves a dialog owner from the canonical list after filtering removes it", () => {
    const filtered = filterProviders(ALL_ROWS, "needs-key");
    expect(findProviderById(filtered, "gemini-primary")).toBeNull();
    expect(findProviderById(ALL_ROWS, "gemini-primary")?.product.name).toBe(
      SELECTABLE_PRODUCTS.find(({ productId }) => productId === "gemini")?.name,
    );
  });

  it("does not serialize the legacy V1 has-api-key field", () => {
    expect(JSON.stringify(ALL_ROWS)).not.toContain(LEGACY_V1_HAS_API_KEY_PROPERTY);
  });
});
