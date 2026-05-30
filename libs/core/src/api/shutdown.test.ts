import { beforeEach, describe, expect, it, vi } from "vitest";
import { shutdown } from "./shutdown";
import type { ApiClient } from "./types";
import { createMockClient } from "../testing/factories";

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
});
