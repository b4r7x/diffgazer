import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { acceptNotice, PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type { HostedApiProductId } from "@diffgazer/core/schemas/config";
import { requireValue } from "@diffgazer/core/testing/assertions";
import { describe, expect, it, vi } from "vitest";
import { diffgazerHome, loadStore } from "../config/store.test-support.js";

const okResponse = (body: unknown): Response =>
  ({ ok: true, status: 200, headers: new Headers(), json: async () => body }) as Response;

const loadLiveModelLists = () => import("./live-model-lists.js");

const KEY_BEARING_INPUTS = {
  zai: { endpoint: "https://api.z.ai/api/paas/v4", profileId: "general-payg" },
  "opencode-zen": { endpoint: "https://opencode.ai/zen/v1", profileId: "zen" },
} as const;

async function seedConfiguration(
  productId: HostedApiProductId,
  input: { endpoint: string },
  credential: string | null,
): Promise<string> {
  const store = await loadStore();
  const created = await store.runConfigurationAction({
    action: "create",
    input: {
      transportFamily: "hosted-api",
      productId,
      endpoint: input.endpoint,
      ...(credential === null ? {} : { credential: { kind: "literal", value: credential } }),
    },
  });
  if (!created.ok) throw new Error(`expected ${productId} configuration: ${created.error.message}`);
  return requireValue(created.value.configuration?.configurationId, "configurationId");
}

const fetchCalls = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map(([input, init]) => ({
    url: String(input),
    headers: (init as RequestInit | undefined)?.headers,
    redirect: (init as RequestInit | undefined)?.redirect,
  }));

describe("resolveLiveModelList — key-bearing provider lists", () => {
  it.each(
    Object.entries(KEY_BEARING_INPUTS) as [
      HostedApiProductId,
      { endpoint: string; profileId: string },
    ][],
  )("%s: requests {endpoint}/models with that configuration's own bearer credential", async (productId, input) => {
    const configurationId = await seedConfiguration(productId, input, `${productId}-secret`);
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okResponse({ object: "list", data: [{ id: "model-a" }] }));
    const { resolveLiveModelList } = await loadLiveModelLists();

    const list = await resolveLiveModelList({
      configurationId,
      productId,
      endpoint: input.endpoint,
    });

    expect(fetchCalls(spy)).toEqual([
      {
        url: `${input.endpoint}/models`,
        headers: { authorization: `Bearer ${productId}-secret` },
        redirect: "error",
      },
    ]);
    expect(list).toMatchObject({
      cached: false,
      models: [{ id: "model-a", tier: "unknown" }],
    });
    // The list is stored under the endpoint-keyed name, so the profile it was
    // fetched from can never be forgotten into a silent cross-pool cache hit.
    expect(
      existsSync(
        join(
          diffgazerHome,
          "model-lists",
          `configuration-${configurationId}-${input.profileId}.json`,
        ),
      ),
    ).toBe(true);
  });

  it("sends each credential only to the endpoint of the configuration it belongs to", async () => {
    const zaiId = await seedConfiguration("zai", KEY_BEARING_INPUTS.zai, "zai-secret");
    const zenId = await seedConfiguration(
      "opencode-zen",
      KEY_BEARING_INPUTS["opencode-zen"],
      "zen-secret",
    );
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okResponse({ data: [{ id: "model-a" }] }));
    const { resolveLiveModelList } = await loadLiveModelLists();

    await resolveLiveModelList({
      configurationId: zaiId,
      productId: "zai",
      endpoint: KEY_BEARING_INPUTS.zai.endpoint,
    });
    await resolveLiveModelList({
      configurationId: zenId,
      productId: "opencode-zen",
      endpoint: KEY_BEARING_INPUTS["opencode-zen"].endpoint,
    });

    expect(fetchCalls(spy)).toEqual([
      {
        url: "https://api.z.ai/api/paas/v4/models",
        headers: { authorization: "Bearer zai-secret" },
        redirect: "error",
      },
      {
        url: "https://opencode.ai/zen/v1/models",
        headers: { authorization: "Bearer zen-secret" },
        redirect: "error",
      },
    ]);
  });

  it("reads an OpenAI-standard entry as a bare id with an unknown tier", async () => {
    const configurationId = await seedConfiguration("zai", KEY_BEARING_INPUTS.zai, "zai-secret");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okResponse({
        object: "list",
        data: [
          { id: "glm-5.2", object: "model", created: 1755216000, owned_by: "z.ai" },
          { id: "glm-5.3", object: "model", created: 1755820800, owned_by: "z.ai" },
        ],
      }),
    );
    const { resolveLiveModelList } = await loadLiveModelLists();

    const list = await resolveLiveModelList({
      configurationId,
      productId: "zai",
      endpoint: KEY_BEARING_INPUTS.zai.endpoint,
    });

    // `owned_by` is a vendor slug, not a display name; nothing here is a price.
    expect(list?.models).toEqual([
      { id: "glm-5.2", tier: "unknown" },
      { id: "glm-5.3", tier: "unknown" },
    ]);
  });

  it("caches the list per configuration for five minutes", async () => {
    const configurationId = await seedConfiguration("zai", KEY_BEARING_INPUTS.zai, "zai-secret");
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okResponse({ data: [{ id: "glm-4.7-flash" }] }));
    const { resolveLiveModelList } = await loadLiveModelLists();

    const first = await resolveLiveModelList({
      configurationId,
      productId: "zai",
      endpoint: KEY_BEARING_INPUTS.zai.endpoint,
    });
    const second = await resolveLiveModelList({
      configurationId,
      productId: "zai",
      endpoint: KEY_BEARING_INPUTS.zai.endpoint,
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(first?.cached).toBe(false);
    expect(second).toEqual({ ...first, cached: true });
  });

  it("serves a fresh cached list without reading the credential", async () => {
    const configurationId = await seedConfiguration("zai", KEY_BEARING_INPUTS.zai, "zai-secret");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse({ data: [{ id: "glm-4.7" }] }));
    const { resolveLiveModelList } = await loadLiveModelLists();

    const first = await resolveLiveModelList({
      configurationId,
      productId: "zai",
      endpoint: KEY_BEARING_INPUTS.zai.endpoint,
    });
    rmSync(join(diffgazerHome, "credentials"), { recursive: true, force: true });

    expect(
      await resolveLiveModelList({
        configurationId,
        productId: "zai",
        endpoint: KEY_BEARING_INPUTS.zai.endpoint,
      }),
    ).toEqual({ ...first, cached: true });
  });

  it("requests nothing when the configuration has no credential", async () => {
    const configurationId = await seedConfiguration("zai", KEY_BEARING_INPUTS.zai, null);
    const spy = vi.spyOn(globalThis, "fetch");
    const { resolveLiveModelList } = await loadLiveModelLists();

    expect(
      await resolveLiveModelList({
        configurationId,
        productId: "zai",
        endpoint: KEY_BEARING_INPUTS.zai.endpoint,
      }),
    ).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("requests nothing for an unknown configuration", async () => {
    await loadStore();
    const spy = vi.spyOn(globalThis, "fetch");
    const { resolveLiveModelList } = await loadLiveModelLists();

    expect(
      await resolveLiveModelList({
        configurationId: "cfg-missing",
        productId: "zai",
        endpoint: KEY_BEARING_INPUTS.zai.endpoint,
      }),
    ).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it.each([
    ["opencode-zen", KEY_BEARING_INPUTS["opencode-zen"], 401],
    [
      "gemini",
      { endpoint: PRODUCT_REGISTRY.gemini.configuration.endpoints[0]?.endpoint ?? "" },
      404,
    ],
  ] as [
    HostedApiProductId,
    { endpoint: string },
    number,
  ][])("degrades %s to null and caches nothing when the list endpoint refuses the credential", async (productId, input, status) => {
    const configurationId = await seedConfiguration(productId, input, `${productId}-secret`);
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status,
      headers: new Headers(),
    } as Response);
    const { resolveLiveModelList } = await loadLiveModelLists();

    expect(
      await resolveLiveModelList({ configurationId, productId, endpoint: input.endpoint }),
    ).toBeNull();
    expect(existsSync(join(diffgazerHome, "model-lists"))).toBe(false);
  });
});

describe("resolveLiveModelList — endpoint-keyed configuration caches", () => {
  const GO_ENDPOINT = "https://opencode.ai/zen/go/v1";

  it("refetches from the new endpoint after a pool switch instead of serving the old pool's fresh cache", async () => {
    const configurationId = await seedConfiguration(
      "opencode-zen",
      KEY_BEARING_INPUTS["opencode-zen"],
      "zen-secret",
    );
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(okResponse({ data: [{ id: "zen-only-model" }] }))
      .mockResolvedValueOnce(okResponse({ data: [{ id: "go-only-model" }] }));
    const { resolveLiveModelList, readCachedLiveModelList } = await loadLiveModelLists();

    const zenList = await resolveLiveModelList({
      configurationId,
      productId: "opencode-zen",
      endpoint: KEY_BEARING_INPUTS["opencode-zen"].endpoint,
    });
    expect(zenList?.models).toEqual([{ id: "zen-only-model", tier: "unknown" }]);

    const store = await loadStore();
    const updated = await store.runConfigurationAction({
      action: "update",
      configurationId,
      expectedRevision: 1,
      input: { transportFamily: "hosted-api", productId: "opencode-zen", endpoint: GO_ENDPOINT },
      acknowledgement: acceptNotice(PRODUCT_REGISTRY["opencode-zen"].notice),
    });
    if (!updated.ok) throw new Error(`expected endpoint switch: ${updated.error.message}`);

    // Dispatch-time read for the new pool misses; the zen cache is never served for it.
    expect(
      readCachedLiveModelList({
        kind: "configuration",
        configurationId,
        productId: "opencode-zen",
        endpointProfileId: "go",
      }),
    ).toBeNull();

    // Within the zen cache's 5-minute TTL, discovery still refetches from Go.
    const goList = await resolveLiveModelList({
      configurationId,
      productId: "opencode-zen",
      endpoint: GO_ENDPOINT,
    });
    expect(fetchCalls(spy).map((call) => call.url)).toEqual([
      "https://opencode.ai/zen/v1/models",
      `${GO_ENDPOINT}/models`,
    ]);
    expect(goList).toMatchObject({
      cached: false,
      models: [{ id: "go-only-model", tier: "unknown" }],
    });
    expect(
      readCachedLiveModelList({
        kind: "configuration",
        configurationId,
        productId: "opencode-zen",
        endpointProfileId: "go",
      })?.models,
    ).toEqual([{ id: "go-only-model", tier: "unknown" }]);
  });

  it("keys and fetches from the caller's endpoint on a cache miss, reading the store only for the credential", async () => {
    const configurationId = await seedConfiguration(
      "opencode-zen",
      KEY_BEARING_INPUTS["opencode-zen"],
      "zen-secret",
    );
    const store = await loadStore();
    const updated = await store.runConfigurationAction({
      action: "update",
      configurationId,
      expectedRevision: 1,
      input: { transportFamily: "hosted-api", productId: "opencode-zen", endpoint: GO_ENDPOINT },
      acknowledgement: acceptNotice(PRODUCT_REGISTRY["opencode-zen"].notice),
    });
    if (!updated.ok) throw new Error(`expected endpoint switch: ${updated.error.message}`);
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okResponse({ data: [{ id: "zen-only-model" }] }));
    const { resolveLiveModelList, readCachedLiveModelList } = await loadLiveModelLists();

    // The store has moved to Go between the caller's own read and this one. The
    // endpoint the caller passed decides the URL and the key together, so the
    // list a Zen request asked for can never be stored under Go's name.
    const list = await resolveLiveModelList({
      configurationId,
      productId: "opencode-zen",
      endpoint: KEY_BEARING_INPUTS["opencode-zen"].endpoint,
    });

    expect(fetchCalls(spy)).toEqual([
      {
        url: `${KEY_BEARING_INPUTS["opencode-zen"].endpoint}/models`,
        headers: { authorization: "Bearer zen-secret" },
        redirect: "error",
      },
    ]);
    expect(list?.models).toEqual([{ id: "zen-only-model", tier: "unknown" }]);
    expect(
      readCachedLiveModelList({
        kind: "configuration",
        configurationId,
        productId: "opencode-zen",
        endpointProfileId: "zen",
      })?.models,
    ).toEqual([{ id: "zen-only-model", tier: "unknown" }]);
    expect(
      existsSync(join(diffgazerHome, "model-lists", `configuration-${configurationId}-go.json`)),
    ).toBe(false);
  });

  it("treats a file under the legacy configuration-<id> key as a cache miss, not a crash", async () => {
    const configurationId = await seedConfiguration("zai", KEY_BEARING_INPUTS.zai, "zai-secret");
    mkdirSync(join(diffgazerHome, "model-lists"), { recursive: true });
    writeFileSync(
      join(diffgazerHome, "model-lists", `configuration-${configurationId}.json`),
      JSON.stringify({
        models: [{ id: "legacy-model", tier: "unknown" }],
        fetchedAt: new Date().toISOString(),
        shapeVersion: 2,
      }),
    );
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okResponse({ data: [{ id: "current-model" }] }));
    const { resolveLiveModelList, readCachedLiveModelList } = await loadLiveModelLists();

    expect(
      readCachedLiveModelList({
        kind: "configuration",
        configurationId,
        productId: "zai",
        endpointProfileId: KEY_BEARING_INPUTS.zai.profileId,
      }),
    ).toBeNull();

    const list = await resolveLiveModelList({
      configurationId,
      productId: "zai",
      endpoint: KEY_BEARING_INPUTS.zai.endpoint,
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(list?.models).toEqual([{ id: "current-model", tier: "unknown" }]);
  });
});

describe("resolveSiblingLiveModelList", () => {
  const GO_PROFILE = requireValue(
    PRODUCT_REGISTRY["opencode-zen"].configuration.endpoints.find((profile) => profile.id === "go"),
    "go endpoint profile",
  );

  it("fetches the sibling pool's list with the configuration's own bearer credential and caches it under the sibling key", async () => {
    const configurationId = await seedConfiguration(
      "opencode-zen",
      KEY_BEARING_INPUTS["opencode-zen"],
      "zen-secret",
    );
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okResponse({ data: [{ id: "go-model" }] }));
    const { resolveSiblingLiveModelList, readCachedLiveModelList } = await loadLiveModelLists();

    const list = await resolveSiblingLiveModelList({
      configurationId,
      productId: "opencode-zen",
      siblingProfile: GO_PROFILE,
    });

    expect(fetchCalls(spy)).toEqual([
      {
        url: "https://opencode.ai/zen/go/v1/models",
        headers: { authorization: "Bearer zen-secret" },
        redirect: "error",
      },
    ]);
    expect(list).toMatchObject({
      cached: false,
      models: [{ id: "go-model", tier: "unknown" }],
    });
    expect(
      existsSync(join(diffgazerHome, "model-lists", `configuration-${configurationId}-go.json`)),
    ).toBe(true);
    expect(
      readCachedLiveModelList({
        kind: "configuration",
        configurationId,
        productId: "opencode-zen",
        endpointProfileId: "go",
      })?.models,
    ).toEqual([{ id: "go-model", tier: "unknown" }]);
  });

  it("degrades to null when the sibling fetch rejects", async () => {
    const configurationId = await seedConfiguration(
      "opencode-zen",
      KEY_BEARING_INPUTS["opencode-zen"],
      "zen-secret",
    );
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const { resolveSiblingLiveModelList } = await loadLiveModelLists();

    await expect(
      resolveSiblingLiveModelList({
        configurationId,
        productId: "opencode-zen",
        siblingProfile: GO_PROFILE,
      }),
    ).resolves.toBeNull();
  });

  it("gives up on a sibling list that keeps the picker waiting, and caches it when it lands", async () => {
    const configurationId = await seedConfiguration(
      "opencode-zen",
      KEY_BEARING_INPUTS["opencode-zen"],
      "zen-secret",
    );
    let answer: (response: Response) => void = () => {};
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    const { resolveSiblingLiveModelList, readCachedLiveModelList, SIBLING_LIST_DEADLINE_MS } =
      await loadLiveModelLists();

    // The bound pool's own list is often a cache hit, so this leg decides how
    // long the picker waits: the whole probe — credential read included — must
    // give up at the deadline and not a moment later.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const flushEventLoop = () => new Promise((resolve) => setImmediate(resolve));
    let settled = false;
    const pending = resolveSiblingLiveModelList({
      configurationId,
      productId: "opencode-zen",
      siblingProfile: GO_PROFILE,
    });
    void pending.then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(SIBLING_LIST_DEADLINE_MS - 1);
    await flushEventLoop();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBeNull();
    vi.useRealTimers();

    // The fetch runs on past the deadline and still warms the cache.
    await vi.waitFor(() => expect(spy).toHaveBeenCalled());
    answer(okResponse({ data: [{ id: "go-model" }] }));
    await vi.waitFor(() =>
      expect(
        readCachedLiveModelList({
          kind: "configuration",
          configurationId,
          productId: "opencode-zen",
          endpointProfileId: "go",
        })?.models,
      ).toEqual([{ id: "go-model", tier: "unknown" }]),
    );
  });

  it("gives up at the deadline when the credential read itself hangs, without touching the network", async () => {
    const configurationId = await seedConfiguration(
      "opencode-zen",
      KEY_BEARING_INPUTS["opencode-zen"],
      "zen-secret",
    );
    // The credential read reaches the OS keyring, which has no abort signal: a
    // locked keychain must not hold the picker open past the sibling deadline.
    const store = await loadStore();
    vi.spyOn(store, "readCurrentState").mockImplementation(() => new Promise<never>(() => {}));
    const spy = vi.spyOn(globalThis, "fetch");
    const { resolveSiblingLiveModelList, SIBLING_LIST_DEADLINE_MS } = await loadLiveModelLists();

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const flushEventLoop = () => new Promise((resolve) => setImmediate(resolve));
    let settled = false;
    const pending = resolveSiblingLiveModelList({
      configurationId,
      productId: "opencode-zen",
      siblingProfile: GO_PROFILE,
    });
    void pending.then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(SIBLING_LIST_DEADLINE_MS - 1);
    await flushEventLoop();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await flushEventLoop();
    expect(settled).toBe(true);
    await expect(pending).resolves.toBeNull();
    vi.useRealTimers();

    expect(spy).not.toHaveBeenCalled();
  });

  it("requests nothing and returns null when the configuration has no credential", async () => {
    const configurationId = await seedConfiguration(
      "opencode-zen",
      KEY_BEARING_INPUTS["opencode-zen"],
      null,
    );
    const spy = vi.spyOn(globalThis, "fetch");
    const { resolveSiblingLiveModelList } = await loadLiveModelLists();

    expect(
      await resolveSiblingLiveModelList({
        configurationId,
        productId: "opencode-zen",
        siblingProfile: GO_PROFILE,
      }),
    ).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("requests nothing and returns null for a product whose model list is public", async () => {
    const configurationId = await seedConfiguration(
      "openrouter",
      { endpoint: "https://openrouter.ai/api/v1" },
      "openrouter-secret",
    );
    const spy = vi.spyOn(globalThis, "fetch");
    const { resolveSiblingLiveModelList } = await loadLiveModelLists();

    expect(
      await resolveSiblingLiveModelList({
        configurationId,
        productId: "openrouter",
        siblingProfile: requireValue(
          PRODUCT_REGISTRY.openrouter.configuration.endpoints[0],
          "openrouter endpoint profile",
        ),
      }),
    ).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("resolveLiveModelList — public products", () => {
  it("never attaches a credential to a public list request", async () => {
    const configurationId = await seedConfiguration(
      "openrouter",
      { endpoint: "https://openrouter.ai/api/v1" },
      "openrouter-secret",
    );
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okResponse({
        data: [
          {
            id: "z-ai/glm-5.2:free",
            name: "Z.AI: GLM 5.2 (free)",
            pricing: { prompt: "0", completion: "0" },
            context_length: 202752,
            supported_parameters: ["structured_outputs", "reasoning"],
          },
          {
            id: "openai/gpt-oss-20b",
            name: "Bearer sk-leaked-into-a-name-0123456789",
            pricing: { prompt: "0.00000004", completion: "0.00000015" },
            context_length: 0,
            supported_parameters: ["tools"],
          },
          { id: "provider/model", pricing: "not-an-object", context_length: "big" },
        ],
      }),
    );
    const { resolveLiveModelList } = await loadLiveModelLists();

    const list = await resolveLiveModelList({
      configurationId,
      productId: "openrouter",
      endpoint: "https://openrouter.ai/api/v1",
    });

    expect(fetchCalls(spy)).toEqual([
      { url: "https://openrouter.ai/api/v1/models", headers: {}, redirect: "error" },
    ]);
    expect(list?.models).toEqual([
      {
        id: "z-ai/glm-5.2:free",
        name: "Z.AI: GLM 5.2 (free)",
        tier: "free",
        contextTokens: 202752,
        structuredOutput: true,
        reasoning: true,
      },
      // An unsafe display name falls back to the id; a zero context is no context.
      { id: "openai/gpt-oss-20b", tier: "paid", structuredOutput: false, reasoning: false },
      // Malformed metadata never drops the id itself.
      { id: "provider/model", tier: "unknown" },
    ]);
  });
});

describe("readCachedLiveModelList — dispatch-time capability reads", () => {
  it("serves the stored list past the refetch TTL instead of degrading capability to null", async () => {
    const configurationId = await seedConfiguration(
      "openrouter",
      { endpoint: "https://openrouter.ai/api/v1" },
      "openrouter-secret",
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okResponse({
        data: [{ id: "provider/strict-model", supported_parameters: ["structured_outputs"] }],
      }),
    );
    const { resolveLiveModelList, readCachedLiveModelList } = await loadLiveModelLists();
    await resolveLiveModelList({
      configurationId,
      productId: "openrouter",
      endpoint: "https://openrouter.ai/api/v1",
    });

    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 6 * 60 * 1000);
      const list = readCachedLiveModelList({ kind: "public", productId: "openrouter" });
      expect(list?.cached).toBe(true);
      expect(list?.models.find((model) => model.id === "provider/strict-model")).toMatchObject({
        structuredOutput: true,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns null for a configuration whose list was never fetched", async () => {
    const configurationId = await seedConfiguration("zai", KEY_BEARING_INPUTS.zai, "zai-secret");
    const { readCachedLiveModelList } = await loadLiveModelLists();
    expect(
      readCachedLiveModelList({
        kind: "configuration",
        configurationId,
        productId: "zai",
        endpointProfileId: KEY_BEARING_INPUTS.zai.profileId,
      }),
    ).toBeNull();
  });

  it("treats a pre-shapeVersion cache as expired on the picker path but still serves it at dispatch", async () => {
    const configurationId = await seedConfiguration(
      "openrouter",
      { endpoint: "https://openrouter.ai/api/v1" },
      "openrouter-secret",
    );
    // A fresh cache written by a pre-upgrade binary: no shapeVersion, and its
    // derived models never carry capability fields like `reasoning`.
    mkdirSync(join(diffgazerHome, "model-lists"), { recursive: true });
    writeFileSync(
      join(diffgazerHome, "model-lists", "openrouter.json"),
      JSON.stringify({
        models: [{ id: "provider/old-shape-model", tier: "unknown" }],
        fetchedAt: new Date().toISOString(),
      }),
    );
    vi.resetModules();
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okResponse({
        data: [{ id: "provider/reasoning-model", supported_parameters: ["reasoning"] }],
      }),
    );
    const { resolveLiveModelList, readCachedLiveModelList } = await loadLiveModelLists();

    // Dispatch path stays no-network: stale capability evidence beats guessing.
    const dispatchList = readCachedLiveModelList({ kind: "public", productId: "openrouter" });
    expect(dispatchList?.models[0]?.id).toBe("provider/old-shape-model");
    expect(spy).not.toHaveBeenCalled();

    // Picker path refetches despite the fresh timestamp, healing the shape.
    const pickerList = await resolveLiveModelList({
      configurationId,
      productId: "openrouter",
      endpoint: "https://openrouter.ai/api/v1",
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(pickerList?.models[0]).toMatchObject({
      id: "provider/reasoning-model",
      reasoning: true,
    });
  });
});

describe("resolveLiveModelList — Gemini's OpenAI-compat list", () => {
  const GEMINI_ENDPOINT = PRODUCT_REGISTRY.gemini.configuration.endpoints[0]?.endpoint ?? "";

  it("requests {endpoint}/openai/models with the configuration's own bearer credential and strips the models/ id prefix", async () => {
    const configurationId = await seedConfiguration(
      "gemini",
      { endpoint: GEMINI_ENDPOINT },
      "gemini-secret",
    );
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okResponse({
        object: "list",
        data: [
          { id: "models/gemini-2.5-flash", object: "model", owned_by: "google" },
          { id: "models/gemini-2.5-pro", object: "model", owned_by: "google" },
          // An id the compat layer serves bare must pass through unchanged.
          { id: "gemma-4-31b-it", object: "model", owned_by: "google" },
        ],
      }),
    );
    const { resolveLiveModelList } = await loadLiveModelLists();

    const list = await resolveLiveModelList({
      configurationId,
      productId: "gemini",
      endpoint: GEMINI_ENDPOINT,
    });

    expect(fetchCalls(spy)).toEqual([
      {
        url: `${GEMINI_ENDPOINT}/openai/models`,
        headers: { authorization: "Bearer gemini-secret" },
        redirect: "error",
      },
    ]);
    // Without the strip, no id matches the catalog and a selected id would
    // double the `models/` prefix in the google dispatch URL.
    expect(list?.models).toEqual([
      { id: "gemini-2.5-flash", tier: "unknown" },
      { id: "gemini-2.5-pro", tier: "unknown" },
      { id: "gemma-4-31b-it", tier: "unknown" },
    ]);
  });
});
