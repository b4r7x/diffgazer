import { beforeEach, describe, expect, it, vi } from "vitest";
import { shutdown } from "./shutdown.js";
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

describe("shutdown API", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it("posts to /api/shutdown with empty body", async () => {
    vi.mocked(client.post).mockResolvedValue({ ok: true });

    const result = await shutdown(client);

    expect(result).toEqual({ ok: true });
    expect(client.post).toHaveBeenCalledWith("/api/shutdown", {});
  });
});
