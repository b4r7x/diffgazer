import {
  findProviderById,
  getBillingTier,
  getProviderRowId,
  mapProviderList,
  offersFreeModels,
  PRODUCT_REGISTRY,
  type ProviderListRow,
  SELECTABLE_PRODUCTS,
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
} from "@diffgazer/core/schemas/config";
import { OPENCODE_GO_CONFIGURATION } from "@diffgazer/core/testing/provider-fixtures";
import { describe, expect, it } from "vitest";
import {
  filterProviders,
  filterUnrecognizedConfigurations,
  PROVIDER_FILTER_LABELS,
  PROVIDER_FILTERS,
} from "./filter";

function copyNotice(productId: RunnableProductId) {
  const notice = PRODUCT_REGISTRY[productId].notice;
  return { ...notice, billing: [...notice.billing], privacy: [...notice.privacy] };
}

const NON_READY_EVIDENCE = {
  "conformance-pending": { evidenceStatus: "pending", checkedAt: "2026-07-31T12:00:00.000Z" },
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

// Key stored and model selected, but the conformance check has not run, so
// readiness.ready is false.
const PENDING_ZEN = configurationStatus(
  {
    configurationId: "zen-pending",
    revision: 1,
    status: "supported",
    transportFamily: "hosted-api",
    productId: "opencode-zen",
    endpoint: "https://opencode.ai/zen/v1",
    selectedModelId: "grok-code",
    notices: [copyNotice("opencode-zen")],
    availableActions: ["inspect", "select", "test", "update", "delete"],
  },
  "conformance-pending",
);

const ALL_ROWS = mapProviderList([READY_GEMINI, PENDING_ZEN]);

const rowIds = (rows: ProviderListRow[]) => rows.map(getProviderRowId);

describe("filterProviders", () => {
  it("returns all selectable products", () => {
    expect(ALL_ROWS.filter(({ product }) => product.selectable)).toHaveLength(9);
  });

  it("returns every provider when filter is 'all'", () => {
    expect(rowIds(filterProviders(ALL_ROWS, "all"))).toEqual(rowIds(ALL_ROWS));
  });

  it("keeps every stored configuration under 'configured' in list order", () => {
    expect(rowIds(filterProviders(ALL_ROWS, "configured"))).toEqual([
      "zen-pending",
      "gemini-primary",
    ]);
  });

  it("keeps a configured provider awaiting conformance under 'configured'", () => {
    const pending = findProviderById(ALL_ROWS, "zen-pending");
    expect(pending?.readiness.status).toBe("conformance-pending");
    expect(pending?.readiness.ready).toBe(false);

    expect(findProviderById(filterProviders(ALL_ROWS, "configured"), "zen-pending")).not.toBeNull();
  });

  it("leaves the 'configured' list non-empty when the only configuration is pending, so ArrowDown from the filters has a list target", () => {
    const rows = mapProviderList([PENDING_ZEN]);
    expect(rowIds(filterProviders(rows, "configured"))).toEqual(["zen-pending"]);
  });

  it("filters 'needs-key' to products without a stored configuration", () => {
    const ids = rowIds(filterProviders(ALL_ROWS, "needs-key"));
    expect(ids).toContain("zai");
    expect(ids).not.toContain("gemini-primary");
    expect(ids).not.toContain("zen-pending");
  });

  it("partitions 'all' into 'configured' and 'needs-key'", () => {
    const configured = rowIds(filterProviders(ALL_ROWS, "configured"));
    const needsKey = rowIds(filterProviders(ALL_ROWS, "needs-key"));

    expect([...configured, ...needsKey].sort()).toEqual(
      rowIds(filterProviders(ALL_ROWS, "all")).sort(),
    );
  });

  // Gemini's models are all priced, so it stays on the paid side, but Google
  // publishes a free tier to run them on — the Free tab is where a user looking
  // for a no-cost start goes, and hiding Gemini from it hides the answer.
  it("lists a declared free tier under both filters and a PAYG-only product under paid alone", () => {
    const freeIds = rowIds(filterProviders(ALL_ROWS, "free"));
    const paidIds = rowIds(filterProviders(ALL_ROWS, "paid"));

    expect(getBillingTier("gemini")).toBe("free-tier");
    expect(freeIds).toContain("gemini-primary");
    expect(paidIds).toContain("gemini-primary");

    expect(getBillingTier("deepseek")).toBe("paid");
    expect(freeIds).not.toContain("deepseek");
    expect(paidIds).toContain("deepseek");
  });

  // OpenRouter's zero-priced `:free` entries are pinned catalog identities its
  // picker really offers, so both tabs must list it.
  it("lists a product selling both free and priced models under both filters", () => {
    expect(getBillingTier("openrouter")).toBe("mixed");
    expect(rowIds(filterProviders(ALL_ROWS, "free"))).toContain("openrouter");
    expect(rowIds(filterProviders(ALL_ROWS, "paid"))).toContain("openrouter");

    // Zen earns the same mix from its zero-priced catalog models, so its
    // stored configuration surfaces under both tabs too.
    expect(getBillingTier("opencode-zen")).toBe("mixed");
    expect(rowIds(filterProviders(ALL_ROWS, "free"))).toContain("zen-pending");
    expect(rowIds(filterProviders(ALL_ROWS, "paid"))).toContain("zen-pending");

    expect(offersFreeModels("mixed")).toBe(true);
    expect(offersFreeModels("free")).toBe(true);
    expect(offersFreeModels("paid")).toBe(false);
  });

  it("matches search query against product name and id", () => {
    expect(rowIds(filterProviders(ALL_ROWS, "all", "google"))).toEqual(["gemini-primary"]);
    expect(rowIds(filterProviders(ALL_ROWS, "all", "zai"))).toEqual(["zai"]);
  });

  // The row renders as its short name and bound pool, so the name a user can
  // read is the name they can type; the product name keeps working because
  // unconfigured rows show it.
  it("matches search against the short display name a configured dual-pool row shows", () => {
    const rows = mapProviderList([
      configurationStatus(OPENCODE_GO_CONFIGURATION, "conformance-pending"),
    ]);

    expect(rowIds(filterProviders(rows, "all", "opencode · go"))).toEqual(["opencode-go"]);
    expect(rowIds(filterProviders(rows, "all", "opencode zen"))).toEqual(["opencode-go"]);
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

  it("orders the rendered filter chips like the keyboard index tuple", () => {
    // The keyboard layer stores a filter as its PROVIDER_FILTERS index and the list
    // resolves that index through PROVIDER_FILTER_LABELS; a divergence would focus
    // the wrong chip.
    expect(PROVIDER_FILTER_LABELS.map(({ value }) => value)).toEqual([...PROVIDER_FILTERS]);
    expect(PROVIDER_FILTER_LABELS.every(({ label }) => label.length > 0)).toBe(true);
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

  // The record is a stored configuration, so it stays reachable under the two
  // filters that ask about storage, and is not claimed by the product filters
  // that ask about a product it has none of.
  it("offers an undecodable record under the storage filters only", () => {
    const unrecognized = [{ configurationId: "cfg-retired" }];

    expect(filterUnrecognizedConfigurations(unrecognized, "all")).toEqual(unrecognized);
    expect(filterUnrecognizedConfigurations(unrecognized, "configured")).toEqual(unrecognized);
    expect(filterUnrecognizedConfigurations(unrecognized, "needs-key")).toEqual([]);
    expect(filterUnrecognizedConfigurations(unrecognized, "free")).toEqual([]);
    expect(filterUnrecognizedConfigurations(unrecognized, "paid")).toEqual([]);
  });

  it("finds an undecodable record by its id or by the name the list gives it", () => {
    const unrecognized = [{ configurationId: "cfg-retired" }];

    expect(filterUnrecognizedConfigurations(unrecognized, "all", "retired")).toEqual(unrecognized);
    expect(filterUnrecognizedConfigurations(unrecognized, "all", "unrecognized")).toEqual(
      unrecognized,
    );
    expect(filterUnrecognizedConfigurations(unrecognized, "all", "gemini")).toEqual([]);
  });
});
