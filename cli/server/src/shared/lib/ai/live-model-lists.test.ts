import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type { HostedApiProductId } from "@diffgazer/core/schemas/config";
import { requireValue } from "@diffgazer/core/testing/assertions";
import { describe, expect, it, vi } from "vitest";
import { diffgazerHome, loadStore } from "../config/store.test-support.js";

const okResponse = (body: unknown): Response =>
  ({ ok: true, status: 200, headers: new Headers(), json: async () => body }) as Response;

const loadLiveModelLists = () => import("./live-model-lists.js");

const KEY_BEARING_INPUTS = {
  zai: { endpoint: "https://api.z.ai/api/paas/v4" },
  "opencode-zen": { endpoint: "https://opencode.ai/zen/v1" },
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
      ...input,
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
    Object.entries(KEY_BEARING_INPUTS) as [HostedApiProductId, { endpoint: string }][],
  )("%s: requests {endpoint}/models with that configuration's own bearer credential", async (productId, input) => {
    const configurationId = await seedConfiguration(productId, input, `${productId}-secret`);
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okResponse({ object: "list", data: [{ id: "model-a" }] }));
    const { resolveLiveModelList } = await loadLiveModelLists();

    const list = await resolveLiveModelList({ configurationId, productId });

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
    expect(
      existsSync(join(diffgazerHome, "model-lists", `configuration-${configurationId}.json`)),
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

    await resolveLiveModelList({ configurationId: zaiId, productId: "zai" });
    await resolveLiveModelList({ configurationId: zenId, productId: "opencode-zen" });

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

    const list = await resolveLiveModelList({ configurationId, productId: "zai" });

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

    const first = await resolveLiveModelList({ configurationId, productId: "zai" });
    const second = await resolveLiveModelList({ configurationId, productId: "zai" });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(first?.cached).toBe(false);
    expect(second).toEqual({ ...first, cached: true });
  });

  it("serves a fresh cached list without reading the credential", async () => {
    const configurationId = await seedConfiguration("zai", KEY_BEARING_INPUTS.zai, "zai-secret");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse({ data: [{ id: "glm-4.7" }] }));
    const { resolveLiveModelList } = await loadLiveModelLists();

    const first = await resolveLiveModelList({ configurationId, productId: "zai" });
    rmSync(join(diffgazerHome, "credentials"), { recursive: true, force: true });

    expect(await resolveLiveModelList({ configurationId, productId: "zai" })).toEqual({
      ...first,
      cached: true,
    });
  });

  it("requests nothing when the configuration has no credential", async () => {
    const configurationId = await seedConfiguration("zai", KEY_BEARING_INPUTS.zai, null);
    const spy = vi.spyOn(globalThis, "fetch");
    const { resolveLiveModelList } = await loadLiveModelLists();

    expect(await resolveLiveModelList({ configurationId, productId: "zai" })).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("requests nothing for an unknown configuration", async () => {
    await loadStore();
    const spy = vi.spyOn(globalThis, "fetch");
    const { resolveLiveModelList } = await loadLiveModelLists();

    expect(
      await resolveLiveModelList({ configurationId: "cfg-missing", productId: "zai" }),
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

    expect(await resolveLiveModelList({ configurationId, productId })).toBeNull();
    expect(existsSync(join(diffgazerHome, "model-lists"))).toBe(false);
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

    const list = await resolveLiveModelList({ configurationId, productId: "openrouter" });

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
    await resolveLiveModelList({ configurationId, productId: "openrouter" });

    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 6 * 60 * 1000);
      const list = readCachedLiveModelList({ configurationId, productId: "openrouter" });
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
    expect(readCachedLiveModelList({ configurationId, productId: "zai" })).toBeNull();
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
    const dispatchList = readCachedLiveModelList({ configurationId, productId: "openrouter" });
    expect(dispatchList?.models[0]?.id).toBe("provider/old-shape-model");
    expect(spy).not.toHaveBeenCalled();

    // Picker path refetches despite the fresh timestamp, healing the shape.
    const pickerList = await resolveLiveModelList({ configurationId, productId: "openrouter" });
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

    const list = await resolveLiveModelList({ configurationId, productId: "gemini" });

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
