import { beforeEach, describe, expect, it, vi } from "vitest";
import { activateProvider, getProviderStatus } from "./config.js";
import { createMockClient } from "./test-helpers.js";
import type { ApiClient } from "./types.js";

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

  it("getProviderStatus validates the response shape, rejecting a drifted payload", async () => {
    vi.mocked(client.get).mockResolvedValue({ providers: [] });

    await getProviderStatus(client);

    const validate = vi.mocked(client.get).mock.calls[0]?.[2];
    expect(validate).toBeDefined();
    expect(() => validate?.({ providers: [{ provider: "not-a-provider" }] })).toThrow();
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
});
