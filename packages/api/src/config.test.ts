import { describe, it, expect, vi, beforeEach } from "vitest";
import { getProviderStatus, getTrust, deleteTrust, activateProvider } from "./config.js";
import type { ApiClient } from "./types.js";

function createMockClient(): ApiClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    stream: vi.fn(),
    request: vi.fn(),
  };
}

describe("config API functions", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it("getProviderStatus calls correct path and unwraps providers", async () => {
    const providers = [{ provider: "gemini", hasApiKey: true, isActive: true }];
    vi.mocked(client.get).mockResolvedValue({ providers });

    const result = await getProviderStatus(client);

    expect(client.get).toHaveBeenCalledWith("/api/config/providers");
    expect(result).toEqual(providers);
  });

  it("getTrust passes projectId as query param", async () => {
    const trust = { projectId: "proj-1", trusted: true };
    vi.mocked(client.get).mockResolvedValue({ trust });

    await getTrust(client, "proj-1");

    expect(client.get).toHaveBeenCalledWith("/api/settings/trust", { projectId: "proj-1" });
  });

  it("activateProvider builds URL with provider ID", async () => {
    vi.mocked(client.post).mockResolvedValue({ provider: "gemini" });

    await activateProvider(client, "gemini", "gemini-2.5-flash");

    expect(client.post).toHaveBeenCalledWith(
      "/api/config/provider/gemini/activate",
      { model: "gemini-2.5-flash" }
    );
  });

  it("activateProvider sends empty body without model", async () => {
    vi.mocked(client.post).mockResolvedValue({ provider: "gemini" });

    await activateProvider(client, "gemini");

    expect(client.post).toHaveBeenCalledWith(
      "/api/config/provider/gemini/activate",
      {}
    );
  });
});
