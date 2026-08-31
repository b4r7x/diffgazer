import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getEndpointPoolContext } from "@diffgazer/core/providers";
import { requireValue } from "@diffgazer/core/testing/assertions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigStore } from "../config/store.js";
import { assertTempHome } from "../testing/temp-home.js";
import { describeHttpFailure } from "./providers/hosted/failure-classification.js";

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/v1";
const DEEPSEEK_LIST_URL = `${DEEPSEEK_ENDPOINT}/models`;
const MOONSHOT_INTERNATIONAL_ENDPOINT = "https://api.moonshot.ai/v1";
const MOONSHOT_MAINLAND_ENDPOINT = "https://api.moonshot.cn/v1";
const MOONSHOT_LIST_URL = `${MOONSHOT_INTERNATIONAL_ENDPOINT}/models`;
const MODELS_DEV_URL = "https://models.dev/api.json";

const DEEPSEEK_CATALOG = {
  deepseek: {
    id: "deepseek",
    models: {
      "deepseek-v4-flash": {
        id: "deepseek-v4-flash",
        name: "DeepSeek V4 Flash",
        cost: { input: 0.28, output: 0.42 },
        limit: { context: 131072 },
        structured_output: true,
      },
    },
  },
};

const MOONSHOT_CATALOG = {
  moonshotai: {
    id: "moonshotai",
    models: {
      "kimi-k3": {
        id: "kimi-k3",
        name: "Kimi K3",
        cost: { input: 0.6, output: 2.5 },
        limit: { context: 262144 },
        structured_output: true,
      },
    },
  },
};

const okResponse = (body: unknown): Response =>
  ({ ok: true, status: 200, headers: new Headers(), json: async () => body }) as Response;

let testHome: string;
let openedStore: ConfigStore | undefined;

beforeEach(() => {
  testHome = fs.mkdtempSync(path.join(os.tmpdir(), "dg-containment-"));
  assertTempHome(testHome);
  process.env.DIFFGAZER_HOME = testHome;
  process.env.DEEPSEEK_API_KEY = "test-only-deepseek-key";
  process.env.MOONSHOT_API_KEY = "test-only-moonshot-key";
  delete process.env.DIFFGAZER_OFFLINE;
  vi.resetModules();
  vi.restoreAllMocks();
});

// Settle the store before removing the temp home and only then clear DIFFGAZER_HOME:
// `paths.ts` re-reads the variable per call, so a still-pending write after a failed
// assertion would otherwise land in the real ~/.diffgazer.
afterEach(async () => {
  await openedStore?.ready();
  openedStore = undefined;
  fs.rmSync(testHome, { recursive: true, force: true });
  delete process.env.DIFFGAZER_HOME;
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.MOONSHOT_API_KEY;
});

/**
 * A product whose endpoints are not billing pools must be untouched by the pool
 * machinery: one list request, unlabeled rows, and the copy every other product
 * has always produced.
 */
describe("single-endpoint product containment", () => {
  it("discovers DeepSeek with one list request and rows carrying no pool membership", async () => {
    const { getStore } = await import("../config/store.js");
    const store = getStore();
    openedStore = store;
    const created = await store.runConfigurationAction({
      action: "create",
      input: {
        transportFamily: "hosted-api",
        productId: "deepseek",
        endpoint: DEEPSEEK_ENDPOINT,
        credential: { kind: "environment" },
      },
    });
    if (!created.ok) throw new Error(`expected a deepseek configuration: ${created.error.message}`);
    const configurationId = requireValue(
      created.value.configuration?.configurationId,
      "configurationId",
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === MODELS_DEV_URL) return okResponse(DEEPSEEK_CATALOG);
      if (url === DEEPSEEK_LIST_URL) {
        return okResponse({ object: "list", data: [{ id: "deepseek-v4-flash" }] });
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    const { discoverConfigurationCatalog } = await import("./models-dev-catalog/index.js");
    const result = await discoverConfigurationCatalog({
      configurationId,
      productId: "deepseek",
      endpoint: DEEPSEEK_ENDPOINT,
    });

    expect(
      fetchSpy.mock.calls.map(([input]) => String(input)).filter((url) => url !== MODELS_DEV_URL),
    ).toEqual([DEEPSEEK_LIST_URL]);
    expect(result.status).toBe("passed");
    if (result.status !== "passed") return;
    expect(result.models).toEqual([
      {
        id: "deepseek-v4-flash",
        name: "DeepSeek V4 Flash",
        description: "131K context",
        tier: "paid",
      },
    ]);
  });

  it("has no pool context and keeps the product-named failure copy", () => {
    expect(getEndpointPoolContext("deepseek", DEEPSEEK_ENDPOINT)).toBeNull();
    expect(describeHttpFailure("deepseek", 402)).toEqual({
      code: "provider-rejected",
      retryable: false,
      message: "DeepSeek reported billing or quota exhausted (HTTP 402).",
      remediation: "Check the account balance or plan, or change the model.",
    });
  });
});

/**
 * Moonshot's two endpoints are regions with separate accounts and separate
 * keys, not billing pools, so the pool machinery must stay out of it: the
 * international key is never sent to the mainland host, and no row claims a
 * pool. Endpoint count is not the gate — `endpointSources` is.
 */
describe("multi-endpoint non-pool product containment", () => {
  it("discovers Moonshot without probing its other region and leaves rows unlabeled", async () => {
    const { getStore } = await import("../config/store.js");
    const store = getStore();
    openedStore = store;
    const created = await store.runConfigurationAction({
      action: "create",
      input: {
        transportFamily: "hosted-api",
        productId: "moonshot",
        endpoint: MOONSHOT_INTERNATIONAL_ENDPOINT,
        credential: { kind: "environment" },
      },
    });
    if (!created.ok) throw new Error(`expected a moonshot configuration: ${created.error.message}`);
    const configurationId = requireValue(
      created.value.configuration?.configurationId,
      "configurationId",
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === MODELS_DEV_URL) return okResponse(MOONSHOT_CATALOG);
      if (url === MOONSHOT_LIST_URL)
        return okResponse({ object: "list", data: [{ id: "kimi-k3" }] });
      throw new Error(`unexpected fetch ${url}`);
    });

    const { discoverConfigurationCatalog } = await import("./models-dev-catalog/index.js");
    const result = await discoverConfigurationCatalog({
      configurationId,
      productId: "moonshot",
      endpoint: MOONSHOT_INTERNATIONAL_ENDPOINT,
    });

    expect(
      fetchSpy.mock.calls.map(([input]) => String(input)).filter((url) => url !== MODELS_DEV_URL),
    ).toEqual([MOONSHOT_LIST_URL]);
    expect(result.status).toBe("passed");
    if (result.status !== "passed") return;
    expect(result.models).toEqual([
      {
        id: "kimi-k3",
        name: "Kimi K3",
        description: "262K context",
        tier: "paid",
      },
    ]);
  });

  it("has no pool context on either region", () => {
    expect(getEndpointPoolContext("moonshot", MOONSHOT_INTERNATIONAL_ENDPOINT)).toBeNull();
    expect(getEndpointPoolContext("moonshot", MOONSHOT_MAINLAND_ENDPOINT)).toBeNull();
  });
});
