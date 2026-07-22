import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "./client.js";
import {
  activateProvider,
  deleteProviderCredentials,
  getOpenRouterModels,
  getProviderModels,
  getProviderStatus,
} from "./config.js";
import { createMockClient } from "./test-helpers.js";
import { type ApiClient, isApiError } from "./types.js";

const providerPathCases = [
  ["slash", "unknown/provider", "unknown%2Fprovider"],
  ["percent", "provider%name", "provider%25name"],
  ["literal encoded slash", "provider%2Fname", "provider%252Fname"],
  ["Unicode", "模型", "%E6%A8%A1%E5%9E%8B"],
  ["query delimiter", "provider?mode=test", "provider%3Fmode%3Dtest"],
  ["fragment delimiter", "provider#details", "provider%23details"],
  ["spaces", "provider name", "provider%20name"],
] as const;

describe("config API functions", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it("getProviderStatus returns the unwrapped providers list from the config endpoint", async () => {
    const providers = [{ provider: "gemini", hasApiKey: true, isActive: true }];
    vi.mocked(client.get).mockResolvedValue({ providers });

    const result = await getProviderStatus(client);

    expect(client.get).toHaveBeenCalledWith(
      "/api/config/providers",
      undefined,
      expect.any(Function),
    );
    expect(result).toEqual(providers);
  });

  it("rejects a drifted provider payload with ApiError", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ providers: [{ provider: "not-a-provider" }] }));
    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", fetchMock);

    const apiClient = createApiClient({ baseUrl: "http://localhost:3000" });
    let error: unknown;
    try {
      await getProviderStatus(apiClient);
    } catch (caught) {
      error = caught;
    } finally {
      vi.stubGlobal("fetch", originalFetch);
    }

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/config/providers",
      expect.objectContaining({ method: "GET" }),
    );
    expect(isApiError(error)).toBe(true);
    if (!isApiError(error)) throw new Error("Expected ApiError");
    expect(error.status).toBe(422);
    expect(error.code).toBe("INVALID_RESPONSE");
  });

  it.each([
    {
      label: "with model='gemini-2.5-flash'",
      model: "gemini-2.5-flash" as string | undefined,
      expectedBody: { model: "gemini-2.5-flash" },
    },
    {
      label: "with model=undefined",
      model: undefined as string | undefined,
      expectedBody: {},
    },
  ])("activateProvider activates the chosen provider $label", async ({ model, expectedBody }) => {
    vi.mocked(client.post).mockResolvedValue({ provider: "gemini" });

    await activateProvider(client, "gemini", model);

    expect(client.post).toHaveBeenCalledWith("/api/config/provider/gemini/activate", expectedBody);
  });

  it.each(
    providerPathCases,
  )("getProviderModels encodes a provider containing %s exactly once", async (_label, providerId, encodedProviderId) => {
    await getProviderModels(client, providerId);

    expect(client.get).toHaveBeenCalledWith(
      `/api/config/provider/${encodedProviderId}/models`,
      undefined,
      expect.any(Function),
    );
  });

  it.each(
    providerPathCases,
  )("activateProvider encodes a provider containing %s exactly once", async (_label, providerId, encodedProviderId) => {
    vi.mocked(client.post).mockResolvedValue({ provider: "gemini" });

    await activateProvider(client, providerId, undefined);

    expect(client.post).toHaveBeenCalledWith(
      `/api/config/provider/${encodedProviderId}/activate`,
      {},
    );
  });

  it.each(
    providerPathCases,
  )("deleteProviderCredentials encodes a provider containing %s exactly once", async (_label, providerId, encodedProviderId) => {
    await deleteProviderCredentials(client, providerId);

    expect(client.delete).toHaveBeenCalledWith(`/api/config/provider/${encodedProviderId}`);
  });

  it("keeps the OpenRouter models endpoint constant", async () => {
    await getOpenRouterModels(client);

    expect(client.get).toHaveBeenCalledWith(
      "/api/config/provider/openrouter/models",
      undefined,
      expect.any(Function),
    );
  });
});
