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

  it("posts to /api/shutdown with empty body", async () => {
    vi.mocked(client.post).mockResolvedValue({ ok: true });

    const result = await shutdown(client);

    expect(result).toEqual({ ok: true });
    expect(client.post).toHaveBeenCalledWith("/api/shutdown", {});
  });

  it("sends the shutdown token only on the shutdown request", async () => {
    vi.mocked(client.post).mockResolvedValue({ ok: true });

    await shutdown(client, " token ");

    expect(client.post).toHaveBeenCalledWith(
      "/api/shutdown",
      {},
      { headers: { [SHUTDOWN_TOKEN_HEADER]: "token" } },
    );
  });
});
