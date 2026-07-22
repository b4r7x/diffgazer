import { PROJECT_ROOT_HEADER, SHUTDOWN_TOKEN_HEADER } from "@diffgazer/core/api/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureShutdownToken } from "./shutdown-token";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TUI API client", () => {
  it("relies on the server environment instead of sending the process cwd, and sends the process shutdown token", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { headers: { "Content-Type": "application/json" } }));
    const { api } = await import("./api");

    await api.client.get("/api/test");

    const request = fetchMock.mock.calls[0]?.[1];
    const headers = new Headers(request?.headers);
    expect(headers.has(PROJECT_ROOT_HEADER)).toBe(false);
    expect(headers.get(SHUTDOWN_TOKEN_HEADER)).toBe(ensureShutdownToken());
  });
});
