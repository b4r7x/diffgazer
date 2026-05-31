import { describe, it, expect, vi, beforeEach } from "vitest";
import { getProviderStatus, getTrust, deleteTrust, activateProvider } from "./config.js";
import type { ApiClient } from "./types.js";
import { createMockClient } from "../testing/factories.js";

describe("config API functions", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it("getProviderStatus returns the unwrapped providers list from the config endpoint", async () => {
    const providers = [{ provider: "gemini", hasApiKey: true, isActive: true }];
    vi.mocked(client.get).mockResolvedValue({ providers });

    const result = await getProviderStatus(client);

    expect(client.get).toHaveBeenCalledWith("/api/config/providers");
    expect(result).toEqual(providers);
  });

  it("getTrust queries the trust endpoint scoped to the given project", async () => {
    const trust = { projectId: "proj-1", trusted: true };
    vi.mocked(client.get).mockResolvedValue({ trust });

    await getTrust(client, "proj-1");

    expect(client.get).toHaveBeenCalledWith("/api/settings/trust", { projectId: "proj-1" });
  });

  it("deleteTrust removes the trust entry for the given project and forwards the response", async () => {
    vi.mocked(client.delete).mockResolvedValue({ removed: true });

    const result = await deleteTrust(client, "proj-1");

    expect(client.delete).toHaveBeenCalledWith("/api/settings/trust", { projectId: "proj-1" });
    expect(result).toEqual({ removed: true });
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

    expect(client.post).toHaveBeenCalledWith(
      "/api/config/provider/gemini/activate",
      expectedBody,
    );
  });
});
