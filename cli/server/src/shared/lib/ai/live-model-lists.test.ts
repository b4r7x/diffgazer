import { existsSync, rmSync } from "node:fs";
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
  groq: { endpoint: "https://api.groq.com/openai/v1" },
  cerebras: { endpoint: "https://api.cerebras.ai/v1" },
  deepseek: { endpoint: "https://api.deepseek.com/v1" },
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
    const groqId = await seedConfiguration("groq", KEY_BEARING_INPUTS.groq, "groq-secret");
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okResponse({ data: [{ id: "model-a" }] }));
    const { resolveLiveModelList } = await loadLiveModelLists();

    await resolveLiveModelList({ configurationId: zaiId, productId: "zai" });
    await resolveLiveModelList({ configurationId: groqId, productId: "groq" });

    expect(fetchCalls(spy)).toEqual([
      {
        url: "https://api.z.ai/api/paas/v4/models",
        headers: { authorization: "Bearer zai-secret" },
        redirect: "error",
      },
      {
        url: "https://api.groq.com/openai/v1/models",
        headers: { authorization: "Bearer groq-secret" },
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

  it("degrades to null when the endpoint refuses the credential", async () => {
    const configurationId = await seedConfiguration("groq", KEY_BEARING_INPUTS.groq, "groq-secret");
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers(),
    } as Response);
    const { resolveLiveModelList } = await loadLiveModelLists();

    expect(await resolveLiveModelList({ configurationId, productId: "groq" })).toBeNull();
    expect(existsSync(join(diffgazerHome, "model-lists"))).toBe(false);
  });
});

describe("resolveLiveModelList — public and catalog-only products", () => {
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
            supported_parameters: ["structured_outputs"],
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
      },
      // An unsafe display name falls back to the id; a zero context is no context.
      { id: "openai/gpt-oss-20b", tier: "paid", structuredOutput: false },
      // Malformed metadata never drops the id itself.
      { id: "provider/model", tier: "unknown" },
    ]);
  });

  it("requests nothing for Google Gemini, which stays catalog-only", async () => {
    const configurationId = await seedConfiguration(
      "gemini",
      { endpoint: PRODUCT_REGISTRY.gemini.configuration.endpoints[0]?.endpoint ?? "" },
      "gemini-secret",
    );
    const spy = vi.spyOn(globalThis, "fetch");
    const { resolveLiveModelList } = await loadLiveModelLists();

    expect(await resolveLiveModelList({ configurationId, productId: "gemini" })).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});
