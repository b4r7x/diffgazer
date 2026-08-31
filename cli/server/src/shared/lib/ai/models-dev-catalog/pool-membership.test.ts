import type { ModelsDevCatalog } from "@diffgazer/core/catalog";
import { requireValue } from "@diffgazer/core/testing/assertions";
import { describe, expect, it, vi } from "vitest";
import { loadStore } from "../../config/store.test-support.js";
import type { LiveModelList } from "../live-model-lists.js";
import {
  beginPoolMembership,
  endpointProfileIdsForModel,
  type PoolDiscoveryTuple,
  type PoolMembership,
  resolvePoolMembership,
} from "./pool-membership.js";

const ZEN_ENDPOINT = "https://opencode.ai/zen/v1";
const GO_ENDPOINT = "https://opencode.ai/zen/go/v1";

// Mirrors the snapshot's two opencode sources: the Zen source carries its own
// ids plus the overlap, the Go source carries the overlap plus subscriber-only
// ids. The overlap is what a deduped read would mislabel Zen-only.
const catalogModel = (id: string) => ({ id, name: id });
const OPENCODE_CATALOG = {
  opencode: {
    id: "opencode",
    models: {
      "deepseek-v4-flash": catalogModel("deepseek-v4-flash"),
      "nemotron-3-ultra-free": catalogModel("nemotron-3-ultra-free"),
    },
  },
  "opencode-go": {
    id: "opencode-go",
    models: {
      "deepseek-v4-flash": catalogModel("deepseek-v4-flash"),
      "qwen3.7-max": catalogModel("qwen3.7-max"),
    },
  },
} satisfies ModelsDevCatalog;

const zenBound: PoolDiscoveryTuple = {
  configurationId: "cfg-zen",
  productId: "opencode-zen",
  endpoint: ZEN_ENDPOINT,
};

const siblingList = (ids: readonly string[]): LiveModelList => ({
  models: ids.map((id) => ({ id, tier: "unknown" as const })),
  fetchedAt: "2026-08-30T00:00:00.000Z",
  cached: false,
});

// `offline: true` keeps the sibling list out of the request, so these cases
// exercise membership over lists the test supplies without any fetch.
const membershipFor = async (
  tuple: PoolDiscoveryTuple,
  sibling: LiveModelList | null,
): Promise<PoolMembership> => {
  const request = beginPoolMembership(tuple, { offline: true });
  if (!request) throw new Error("Expected a pool context for a dual-pool configuration");
  return resolvePoolMembership(
    sibling === null ? request : { ...request, siblingList: Promise.resolve(sibling) },
    OPENCODE_CATALOG,
  );
};

const profileIds = (
  membership: PoolMembership,
  modelId: string,
  inBoundLiveList = false,
): readonly string[] | undefined =>
  endpointProfileIdsForModel(membership, modelId, { inBoundLiveList });

describe("resolvePoolMembership", () => {
  it("labels catalog membership per source, so overlap ids belong to both pools", async () => {
    const membership = await membershipFor(zenBound, null);

    expect(profileIds(membership, "qwen3.7-max")).toEqual(["go"]);
    expect(profileIds(membership, "deepseek-v4-flash")).toEqual(["zen", "go"]);
    expect(profileIds(membership, "nemotron-3-ultra-free")).toEqual(["zen"]);
  });

  it("labels from the bound side of the pool the configuration is actually on", async () => {
    const membership = await membershipFor({ ...zenBound, endpoint: GO_ENDPOINT }, null);

    expect(membership.boundProfileId).toBe("go");
    expect(profileIds(membership, "qwen3.7-max")).toEqual(["go"]);
    expect(profileIds(membership, "deepseek-v4-flash")).toEqual(["go", "zen"]);
  });

  it("counts the sibling's live list and its catalog source as separate observations", async () => {
    const membership = await membershipFor(zenBound, siblingList(["hy3-preview"]));

    // The sibling now serves a route its catalog source never named...
    expect(profileIds(membership, "hy3-preview", true)).toEqual(["zen", "go"]);
    // ...while an id only its catalog source names still counts as sibling
    // evidence, so the catalog fallback keeps it off a Zen-bound picker.
    expect(profileIds(membership, "qwen3.7-max")).toEqual(["go"]);
  });

  it("keeps the row unlabeled when neither pool was observed to carry the id", async () => {
    const membership = await membershipFor(zenBound, null);

    expect(profileIds(membership, "never-seen")).toBeUndefined();
    // A row the bound live list offers is bound-pool evidence on its own.
    expect(profileIds(membership, "never-seen", true)).toEqual(["zen"]);
  });
});

describe("beginPoolMembership", () => {
  it("starts nothing for a product without the pool datum", () => {
    expect(
      beginPoolMembership(
        {
          configurationId: "cfg-deepseek",
          productId: "deepseek",
          endpoint: "https://api.deepseek.com/v1",
        },
        { offline: false },
      ),
    ).toBeNull();
  });

  it("starts nothing when the endpoint is not one the product declares", () => {
    expect(
      beginPoolMembership(
        { ...zenBound, endpoint: "https://opencode.ai/zen/v2" },
        { offline: false },
      ),
    ).toBeNull();
  });

  it("starts no sibling list while offline", () => {
    expect(beginPoolMembership(zenBound, { offline: true })?.siblingList).toBeNull();
  });

  it("requests the sibling pool's list from its own endpoint with the configuration's bearer credential", async () => {
    const store = await loadStore();
    const created = await store.runConfigurationAction({
      action: "create",
      input: {
        transportFamily: "hosted-api",
        productId: "opencode-zen",
        endpoint: ZEN_ENDPOINT,
        credential: { kind: "literal", value: "zen-secret" },
      },
    });
    if (!created.ok)
      throw new Error(`expected an opencode-zen configuration: ${created.error.message}`);
    const configurationId = requireValue(
      created.value.configuration?.configurationId,
      "configurationId",
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ data: [{ id: "qwen3.7-max" }] }),
    } as Response);
    // The seeded store lives in the module graph this test's home was set up
    // for, so the wiring is exercised through that same graph.
    const { beginPoolMembership: begin } = await import("./pool-membership.js");

    const request = begin({ ...zenBound, configurationId }, { offline: false });
    const list = await requireValue(request?.siblingList, "sibling list");

    expect(fetchSpy.mock.calls.map(([input, init]) => [String(input), init?.headers])).toEqual([
      ["https://opencode.ai/zen/go/v1/models", { authorization: "Bearer zen-secret" }],
    ]);
    expect(list?.models).toEqual([{ id: "qwen3.7-max", tier: "unknown" }]);
  });
});
