import { PROJECT_ROOT_HEADER } from "@diffgazer/core/api/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TUI API client", () => {
  it("relies on the server environment instead of sending the process cwd", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { headers: { "Content-Type": "application/json" } }));
    const { api } = await import("./api");

    await api.client.get("/api/test");

    const request = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(request?.headers).has(PROJECT_ROOT_HEADER)).toBe(false);
  });
});
