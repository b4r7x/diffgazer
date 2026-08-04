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
  ReadinessSchema,
  SELECTABLE_PRODUCTS,
} from "@diffgazer/core/schemas/config";
import { describe, expect, it } from "vitest";
import { filterProviders, PROVIDER_FILTERS } from "./filter";

function copyNotice(productId: RunnableProductId) {
  const notice = PRODUCT_REGISTRY[productId].notice;
  return { ...notice, billing: [...notice.billing], privacy: [...notice.privacy] };
}

const NON_READY_EVIDENCE = {
  "conformance-pending": { evidenceStatus: "pending", checkedAt: "2026-07-31T12:00:00.000Z" },
  unsupported: { evidenceStatus: "not-checked", checkedAt: null },
  "local-endpoint-unreachable": { evidenceStatus: "failed", checkedAt: "2026-07-31T12:00:00.000Z" },
} as const;

function configurationStatus(
  configuration: ClientConfigurationSummary,
  readinessStatus: "ready" | keyof typeof NON_READY_EVIDENCE,
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
          ...NON_READY_EVIDENCE[readinessStatus],
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

// The audited regression: key stored and model selected, but the structured
// review conformance check has not run yet, so readiness.ready is false.
const PENDING_DEEPSEEK = configurationStatus(
  {
    configurationId: "deepseek-pending",
    revision: 1,
    status: "supported",
    transportFamily: "hosted-api",
    productId: "deepseek",
    endpoint: "https://api.deepseek.com/v1",
    selectedModelId: "deepseek-v4-flash",
    notices: [copyNotice("deepseek")],
    availableActions: ["inspect", "select", "test", "update", "delete"],
  },
  "conformance-pending",
);

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

const ALL_ROWS = mapProviderList([
  READY_GEMINI,
  PENDING_DEEPSEEK,
  LOCAL_UNREACHABLE,
  CLI_UNSUPPORTED,
]);

const rowIds = (rows: ProviderListRow[]) => rows.map(getProviderRowId);

describe("filterProviders", () => {
  it("returns all selectable products", () => {
    expect(ALL_ROWS.filter(({ product }) => product.selectable)).toHaveLength(13);
  });

  it("returns every provider when filter is 'all'", () => {
    expect(rowIds(filterProviders(ALL_ROWS, "all"))).toEqual(rowIds(ALL_ROWS));
  });

  it("keeps every stored configuration under 'configured' in list order", () => {
    expect(rowIds(filterProviders(ALL_ROWS, "configured"))).toEqual([
      "gemini-primary",
      "deepseek-pending",
      "local-openai-1",
      "codex-cli-1",
    ]);
  });

  it("keeps a configured provider awaiting conformance under 'configured'", () => {
    const pending = findProviderById(ALL_ROWS, "deepseek-pending");
    expect(pending?.readiness.status).toBe("conformance-pending");
    expect(pending?.readiness.ready).toBe(false);

    expect(
      findProviderById(filterProviders(ALL_ROWS, "configured"), "deepseek-pending"),
    ).not.toBeNull();
  });

  it("leaves the 'configured' list non-empty when the only configuration is pending, so ArrowDown from the filters has a list target", () => {
    const rows = mapProviderList([PENDING_DEEPSEEK]);
    expect(rowIds(filterProviders(rows, "configured"))).toEqual(["deepseek-pending"]);
  });

  it("filters 'needs-key' to products without a stored configuration", () => {
    const ids = rowIds(filterProviders(ALL_ROWS, "needs-key"));
    expect(ids).toContain("zai");
    expect(ids).not.toContain("gemini-primary");
    expect(ids).not.toContain("deepseek-pending");
    expect(ids).not.toContain("local-openai-1");
    expect(ids).not.toContain("codex-cli-1");
  });

  it("partitions 'all' into 'configured' and 'needs-key'", () => {
    const configured = rowIds(filterProviders(ALL_ROWS, "configured"));
    const needsKey = rowIds(filterProviders(ALL_ROWS, "needs-key"));

    expect([...configured, ...needsKey].sort()).toEqual(
      rowIds(filterProviders(ALL_ROWS, "all")).sort(),
    );
  });

  it("partitions free vs paid by product billing modes", () => {
    const freeIds = rowIds(filterProviders(ALL_ROWS, "free"));
    expect(freeIds).toContain("gemini-primary");

    const paidIds = rowIds(filterProviders(ALL_ROWS, "paid"));
    expect(paidIds).toContain("deepseek-pending");
    expect(paidIds).not.toContain("gemini-primary");
  });

  it("matches search query against product name and id", () => {
    expect(rowIds(filterProviders(ALL_ROWS, "all", "google"))).toEqual(["gemini-primary"]);
    expect(rowIds(filterProviders(ALL_ROWS, "all", "zai"))).toEqual(["zai"]);
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
