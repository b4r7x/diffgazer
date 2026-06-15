import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteTrust, getTrust } from "./settings.js";
import { createMockClient } from "./test-helpers.js";
import type { ApiClient } from "./types.js";

describe("settings API functions", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it("getTrust queries the trust endpoint without a client-supplied projectId", async () => {
    const trust = { projectId: "proj-1", trusted: true };
    vi.mocked(client.get).mockResolvedValue({ trust });

    await getTrust(client);

    expect(client.get).toHaveBeenCalledWith("/api/settings/trust");
  });

  it("deleteTrust removes the current project's trust entry and forwards the response", async () => {
    vi.mocked(client.delete).mockResolvedValue({ removed: true });

    const result = await deleteTrust(client);

    expect(client.delete).toHaveBeenCalledWith("/api/settings/trust");
    expect(result).toEqual({ removed: true });
  });
});
