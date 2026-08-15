import { onlineManager, queryOptions } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "./query-client";

describe("queryClient", () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
  });

  it("keeps loopback queries and mutations running while the browser is offline", async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", request);

    onlineManager.setOnline(false);

    await queryClient.fetchQuery(
      queryOptions({
        queryKey: ["offline-health"],
        queryFn: () => fetch("http://localhost/api/health"),
      }),
    );
    await queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationKey: ["offline-mutation"],
        mutationFn: () => fetch("http://localhost/api/shutdown", { method: "POST" }),
      })
      .execute(undefined);

    expect(request).toHaveBeenCalledWith("http://localhost/api/health");
    expect(request).toHaveBeenCalledWith(
      "http://localhost/api/shutdown",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("uses always-on network mode for queries and mutations", () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.networkMode).toBe("always");
    expect(defaults.mutations?.networkMode).toBe("always");
  });
});
