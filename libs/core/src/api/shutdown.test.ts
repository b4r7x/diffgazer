import { beforeEach, describe, expect, it, vi } from "vitest";
import { shutdown } from "./shutdown.js";
import type { ApiClient } from "./types.js";
import { SHUTDOWN_TOKEN_HEADER } from "./protocol.js";
import { createMockClient } from "../testing/factories.js";

describe("shutdown API", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it("requests shutdown at the shutdown endpoint and returns the server response", async () => {
    vi.mocked(client.post).mockResolvedValue({ ok: true });

    const result = await shutdown(client);

    expect(result).toEqual({ ok: true });
    expect(client.post).toHaveBeenCalledWith("/api/shutdown", {});
  });

  it("attaches the trimmed shutdown token as a request-scoped header", async () => {
    vi.mocked(client.post).mockResolvedValue({ ok: true });

    await shutdown(client, " token ");

    expect(client.post).toHaveBeenCalledWith(
      "/api/shutdown",
      {},
      { headers: { [SHUTDOWN_TOKEN_HEADER]: "token" } },
    );
  });
});
