import { describe, expect, test } from "vitest";
import { PROVIDER_OVERLAY } from "../catalog/provider-overlay.js";
import type { ModelInfo } from "../schemas/config/models.js";
import { RUNNABLE_PRODUCT_IDS, type RunnableProductId } from "../schemas/config/transports.js";
import {
  type EndpointPoolContext,
  filterModelsByPool,
  getEndpointPoolContext,
  getEndpointProfile,
  getModelBillingPool,
  getPoolBillingChangeNote,
  getPoolHiddenSelectionNotice,
  nextArmedPoolId,
  poolBadgeLabel,
  resolveSelectEndpoint,
} from "./endpoint-pools.js";
import { PRODUCT_ENDPOINT_TUPLES } from "./product-endpoints.js";

const ZEN_ENDPOINT = "https://opencode.ai/zen/v1";
const GO_ENDPOINT = "https://opencode.ai/zen/go/v1";

function makeModel(endpointProfileIds?: string[]): ModelInfo {
  return {
    id: "deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    description: "",
    tier: "paid",
    ...(endpointProfileIds ? { endpointProfileIds } : {}),
  };
}

function poolProducts(): RunnableProductId[] {
  return RUNNABLE_PRODUCT_IDS.filter((id) => PROVIDER_OVERLAY[id]?.endpointSources !== undefined);
}

describe("endpointSources datum integrity", () => {
  test("every key names an endpoint profile and every value a catalog source of its product", () => {
    const products = poolProducts();

    expect(products).not.toHaveLength(0);
    for (const productId of products) {
      const overlay = PROVIDER_OVERLAY[productId];
      const endpointSources = overlay?.endpointSources ?? {};
      const profiles = PRODUCT_ENDPOINT_TUPLES[productId];

      expect(profiles, productId).toHaveLength(2);
      for (const [profileId, sourceId] of Object.entries(endpointSources)) {
        expect(
          profiles.map(({ id }) => id),
          `${productId}/${profileId}`,
        ).toContain(profileId);
        expect(overlay?.modelsDevIds, `${productId}/${profileId}`).toContain(sourceId);
      }
    }
  });
});

describe("getEndpointProfile", () => {
  test("resolves a profile by exact endpoint URL", () => {
    expect(getEndpointProfile("opencode-zen", GO_ENDPOINT)).toMatchObject({
      id: "go",
      label: "OpenCode Go",
    });
  });

  test("returns null for an unmatched endpoint", () => {
    expect(getEndpointProfile("opencode-zen", "https://opencode.ai/other/v1")).toBeNull();
  });
});

describe("getEndpointPoolContext", () => {
  test("every product without the datum takes the unlabeled path", () => {
    const unlabeled = RUNNABLE_PRODUCT_IDS.filter(
      (id) => PROVIDER_OVERLAY[id]?.endpointSources === undefined,
    );

    expect(unlabeled).not.toHaveLength(0);
    for (const productId of unlabeled) {
      for (const profile of PRODUCT_ENDPOINT_TUPLES[productId]) {
        expect(getEndpointPoolContext(productId, profile.endpoint), productId).toBeNull();
      }
    }
  });

  test.each([
    [ZEN_ENDPOINT, "zen", "go", "opencode", "opencode-go"],
    [GO_ENDPOINT, "go", "zen", "opencode-go", "opencode"],
  ])("binds %s and names the other pool as sibling", (endpoint, boundId, siblingId, boundSourceId, siblingSourceId) => {
    const context = getEndpointPoolContext("opencode-zen", endpoint);

    expect(context?.bound.id).toBe(boundId);
    expect(context?.sibling.id).toBe(siblingId);
    expect(context?.boundSourceId).toBe(boundSourceId);
    expect(context?.siblingSourceId).toBe(siblingSourceId);
  });

  test("returns null when the endpoint does not resolve to a pool profile", () => {
    expect(getEndpointPoolContext("opencode-zen", "https://opencode.ai/other/v1")).toBeNull();
  });
});

function poolContext(endpoint: string): EndpointPoolContext {
  const context = getEndpointPoolContext("opencode-zen", endpoint);
  if (!context) throw new Error(`no pool context for ${endpoint}`);
  return context;
}

describe("getModelBillingPool", () => {
  test("a model only one pool serves bills that pool whichever pool is armed", () => {
    const zen = poolContext(ZEN_ENDPOINT);

    expect(getModelBillingPool(zen, makeModel(["go"]), "zen")?.id).toBe("go");
    expect(getModelBillingPool(zen, makeModel(["go"]), "go")?.id).toBe("go");
    expect(getModelBillingPool(zen, makeModel(["zen"]), "go")?.id).toBe("zen");
    expect(getModelBillingPool(zen, makeModel(["zen"]), "zen")?.id).toBe("zen");
  });

  test("a model both pools serve bills the armed pool", () => {
    const zen = poolContext(ZEN_ENDPOINT);

    expect(getModelBillingPool(zen, makeModel(["zen", "go"]), "zen")).toMatchObject({
      id: "zen",
      shortLabel: "Zen",
    });
    expect(getModelBillingPool(zen, makeModel(["zen", "go"]), "go")).toMatchObject({
      id: "go",
      shortLabel: "Go",
    });
  });

  test("falls back to the bound pool when no pool is armed", () => {
    expect(getModelBillingPool(poolContext(GO_ENDPOINT), makeModel(["zen", "go"]))?.id).toBe("go");
  });

  test("unknown membership follows the armed pool rather than dropping the badge", () => {
    const zen = poolContext(ZEN_ENDPOINT);

    expect(getModelBillingPool(zen, makeModel())?.id).toBe("zen");
    expect(getModelBillingPool(zen, makeModel(), "go")?.id).toBe("go");
  });

  test("returns null off a dual-pool product, where a row has no pool to name", () => {
    expect(getModelBillingPool(null, makeModel(["zen", "go"]), "go")).toBeNull();
  });
});

describe("resolveSelectEndpoint", () => {
  const context = poolContext(ZEN_ENDPOINT);

  test("omits the endpoint while the row bills the pool the configuration is already on", () => {
    expect(
      resolveSelectEndpoint({
        context,
        model: makeModel(["zen", "go"]),
        boundEndpoint: ZEN_ENDPOINT,
      }),
    ).toBeUndefined();
  });

  test("carries the sibling pool's endpoint for a row that only it serves", () => {
    expect(
      resolveSelectEndpoint({
        context,
        model: makeModel(["go"]),
        boundEndpoint: ZEN_ENDPOINT,
      }),
    ).toBe(GO_ENDPOINT);
  });

  test("carries the armed pool for a row both pools serve", () => {
    expect(
      resolveSelectEndpoint({
        context,
        model: makeModel(["zen", "go"]),
        armedProfileId: "go",
        boundEndpoint: ZEN_ENDPOINT,
      }),
    ).toBe(GO_ENDPOINT);
  });

  test("omits the endpoint off a dual-pool product, where billing cannot move", () => {
    expect(
      resolveSelectEndpoint({
        context: null,
        model: makeModel(),
        boundEndpoint: "https://api.z.ai/api/paas/v4",
      }),
    ).toBeUndefined();
  });
});

describe("nextArmedPoolId", () => {
  test("flips between the two pools of the context", () => {
    const context = poolContext(ZEN_ENDPOINT);
    expect(nextArmedPoolId(context, "zen")).toBe("go");
    expect(nextArmedPoolId(context, "go")).toBe("zen");
    // Nothing armed yet reads as the bound pool, so the flip arms the sibling.
    expect(nextArmedPoolId(context, undefined)).toBe("go");
  });
});

describe("poolBadgeLabel", () => {
  test("names the pool with its short label, and nothing off a dual-pool product", () => {
    const zen = poolContext(ZEN_ENDPOINT);

    expect(poolBadgeLabel(zen.bound)).toBe("Zen");
    expect(poolBadgeLabel(zen.sibling)).toBe("Go");
    expect(poolBadgeLabel(null)).toBeUndefined();
  });

  test("falls back to the full label for a profile without a short one", () => {
    expect(poolBadgeLabel({ id: "cn", label: "China", endpoint: "https://example.test/v1" })).toBe(
      "China",
    );
  });
});

describe("getPoolBillingChangeNote", () => {
  test("names the pool a save would move billing to", () => {
    expect(getPoolBillingChangeNote(poolContext(ZEN_ENDPOINT), "go")).toBe(
      "Saving moves billing to OpenCode Go.",
    );
    expect(getPoolBillingChangeNote(poolContext(GO_ENDPOINT), "zen")).toBe(
      "Saving moves billing to OpenCode Zen.",
    );
  });

  test("says nothing while the armed pool is the bound one", () => {
    expect(getPoolBillingChangeNote(poolContext(ZEN_ENDPOINT), "zen")).toBeNull();
    expect(getPoolBillingChangeNote(poolContext(ZEN_ENDPOINT), undefined)).toBeNull();
  });

  test("says nothing off a dual-pool product, where billing cannot move", () => {
    expect(getPoolBillingChangeNote(null, "go")).toBeNull();
  });
});

describe("pool tab filtering", () => {
  const zen = poolContext(ZEN_ENDPOINT);
  const zenOnly: ModelInfo = { ...makeModel(["zen"]), id: "zen-only", name: "Zen Only" };
  const goOnly: ModelInfo = { ...makeModel(["go"]), id: "go-only", name: "Go Only" };
  const shared: ModelInfo = { ...makeModel(["zen", "go"]), id: "shared", name: "Shared" };
  const unknownMembership: ModelInfo = { ...makeModel(), id: "unknown", name: "Unknown" };
  const models = [zenOnly, goOnly, shared, unknownMembership];

  function idsOnTab(
    activeProfileId: string | undefined,
    context: EndpointPoolContext | null = zen,
  ) {
    return filterModelsByPool(models, context, activeProfileId).map((model) => model.id);
  }

  test("filterModelsByPool keeps every row when the product has no pool context or no tab is active", () => {
    expect(idsOnTab("zen", null)).toEqual(["zen-only", "go-only", "shared", "unknown"]);
    expect(idsOnTab(undefined)).toEqual(["zen-only", "go-only", "shared", "unknown"]);
  });

  test("filterModelsByPool lists a shared row under both tabs and an exclusive row only under its own", () => {
    expect(idsOnTab("zen")).toContain("shared");
    expect(idsOnTab("go")).toContain("shared");
    expect(idsOnTab("zen")).toContain("zen-only");
    expect(idsOnTab("zen")).not.toContain("go-only");
    expect(idsOnTab("go")).toContain("go-only");
    expect(idsOnTab("go")).not.toContain("zen-only");
  });

  test("filterModelsByPool passes a row of unknown membership through every tab", () => {
    expect(idsOnTab("zen")).toContain("unknown");
    expect(idsOnTab("go")).toContain("unknown");
  });

  test("getPoolHiddenSelectionNotice names the tab that serves a hidden exclusive row", () => {
    expect(getPoolHiddenSelectionNotice(zen, zenOnly, "go")).toBe("Zen Only is on the Zen tab.");
    expect(getPoolHiddenSelectionNotice(zen, goOnly, "zen")).toBe("Go Only is on the Go tab.");
  });

  test("getPoolHiddenSelectionNotice stays null for a visible, shared, unknown, or non-pool model", () => {
    expect(getPoolHiddenSelectionNotice(zen, zenOnly, "zen")).toBeNull();
    expect(getPoolHiddenSelectionNotice(zen, shared, "go")).toBeNull();
    expect(getPoolHiddenSelectionNotice(zen, unknownMembership, "go")).toBeNull();
    expect(getPoolHiddenSelectionNotice(null, zenOnly, "go")).toBeNull();
    expect(getPoolHiddenSelectionNotice(zen, undefined, "go")).toBeNull();
  });
});
