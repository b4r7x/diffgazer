import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { claimTempHome } from "../../../testing/temp-home.js";
import { LIVE_LIST_SHAPE_VERSION } from "../../live-model-lists.js";
import { describePoolFailure } from "./pool-context.js";

const home = claimTempHome("diffgazer-pool-context-");
afterAll(() => home.release());

const ZEN_ENDPOINT = "https://opencode.ai/zen/v1";
const GO_ENDPOINT = "https://opencode.ai/zen/go/v1";
/** Present in both the `opencode` and `opencode-go` catalog sources. */
const DUAL_POOL_MODEL = "deepseek-v4-flash";
/** Present only in the `opencode-go` source. */
const GO_ONLY_MODEL = "glm-5.3";

const goBound = (patch: { modelId: string; status: number; configurationId?: string }) =>
  describePoolFailure({
    productId: "opencode-zen",
    configurationId: patch.configurationId ?? "configuration-1",
    endpoint: GO_ENDPOINT,
    modelId: patch.modelId,
    status: patch.status,
  });

// Mirrors live-model-lists.ts's `configuration-<id>-<profile>` cache file; a
// drift in that naming makes both assertions in the cache test fail, never pass.
function writeSiblingCache(configurationId: string, modelIds: readonly string[]): void {
  mkdirSync(join(home.path, "model-lists"), { recursive: true });
  writeFileSync(
    join(home.path, "model-lists", `configuration-${configurationId}-zen.json`),
    JSON.stringify({
      models: modelIds.map((id) => ({ id, tier: "unknown" })),
      fetchedAt: new Date().toISOString(),
      shapeVersion: LIVE_LIST_SHAPE_VERSION,
    }),
  );
}

describe("describePoolFailure", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("names the bound pool and the sibling pool that also serves the model", () => {
    expect(goBound({ modelId: DUAL_POOL_MODEL, status: 402 })).toEqual({
      poolLabel: "OpenCode Go",
      siblingLabel: "OpenCode Zen",
    });
  });

  it.each([403, 404])("offers the sibling on a %i, whose fix can be the other pool", (status) => {
    expect(goBound({ modelId: DUAL_POOL_MODEL, status })).toEqual({
      poolLabel: "OpenCode Go",
      siblingLabel: "OpenCode Zen",
    });
  });

  it("claims no alternative for a model only the bound pool serves", () => {
    expect(goBound({ modelId: GO_ONLY_MODEL, status: 402 })).toEqual({ poolLabel: "OpenCode Go" });
  });

  it("leaves a credential rejection without a cross-pool sentence", () => {
    expect(goBound({ modelId: DUAL_POOL_MODEL, status: 401 })).toEqual({
      poolLabel: "OpenCode Go",
    });
  });

  it("offers the sibling on a 429 for the exhausted-quota copy to use", () => {
    // A plain 429 drops it again in describeHttpFailure, which keeps its pacing
    // remediation; only describeExhaustedRateLimit names the switch.
    expect(goBound({ modelId: DUAL_POOL_MODEL, status: 429 })).toEqual({
      poolLabel: "OpenCode Go",
      siblingLabel: "OpenCode Zen",
    });
  });

  it("names the zen pool when the configuration binds the zen endpoint", () => {
    const copy = describePoolFailure({
      productId: "opencode-zen",
      configurationId: "configuration-1",
      endpoint: ZEN_ENDPOINT,
      modelId: DUAL_POOL_MODEL,
      status: 402,
    });

    expect(copy).toEqual({ poolLabel: "OpenCode Zen", siblingLabel: "OpenCode Go" });
  });

  it("prefers the cached sibling list over the bundled snapshot", () => {
    writeSiblingCache("cached-list", [GO_ONLY_MODEL]);

    // The snapshot answers the opposite way for each id — zen serves the dual
    // model and not the go-only one — so the cached zen list is what decides.
    expect(
      goBound({
        modelId: GO_ONLY_MODEL,
        status: 402,
        configurationId: "cached-list",
      }),
    ).toEqual({ poolLabel: "OpenCode Go", siblingLabel: "OpenCode Zen" });
    expect(
      goBound({
        modelId: DUAL_POOL_MODEL,
        status: 402,
        configurationId: "cached-list",
      }),
    ).toEqual({ poolLabel: "OpenCode Go" });
  });

  it("returns null for a product without pool siblings", () => {
    expect(
      describePoolFailure({
        productId: "deepseek",
        configurationId: "configuration-1",
        endpoint: "https://api.deepseek.com/v1",
        modelId: "deepseek-chat",
        status: 402,
      }),
    ).toBeNull();
  });
});
