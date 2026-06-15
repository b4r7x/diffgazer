/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SaveTrustRequest } from "../../schemas/config/index.js";
import type { BoundApi } from "../bound.js";
import { ApiProvider } from "./context.js";
import { configQueries } from "./queries/config.js";
import { reviewQueries } from "./queries/review.js";
import { useDeleteTrust, useSaveTrust } from "./trust.js";

function makeWrapper(api: BoundApi, queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ApiProvider, { value: api }, children),
    );
}

const SAVE_REQUEST: SaveTrustRequest = {
  capabilities: { readFiles: true },
  trustMode: "persistent",
};

describe("trust mutations", () => {
  let api: BoundApi;
  let queryClient: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    api = {
      saveTrust: vi.fn(async () => ({ trust: undefined })),
      deleteTrust: vi.fn(async () => ({ removed: true })),
    } as unknown as BoundApi;
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  });

  function invalidatedKeys(): unknown[][] {
    return invalidateSpy.mock.calls.map(
      ([arg]: [unknown]) => (arg as { queryKey: unknown[] }).queryKey,
    );
  }

  it("invalidates the init and review namespaces on grant", async () => {
    const { result } = renderHook(() => useSaveTrust(), {
      wrapper: makeWrapper(api, queryClient),
    });
    act(() => result.current.mutate(SAVE_REQUEST));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const keys = invalidatedKeys();
    expect(keys).toContainEqual(configQueries.init(api).queryKey);
    expect(keys).toContainEqual(reviewQueries.all());
  });

  it("invalidates the init and review namespaces on revoke", async () => {
    const { result } = renderHook(() => useDeleteTrust(), {
      wrapper: makeWrapper(api, queryClient),
    });
    act(() => result.current.mutate());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const keys = invalidatedKeys();
    expect(keys).toContainEqual(configQueries.init(api).queryKey);
    expect(keys).toContainEqual(reviewQueries.all());
  });

  it("revoke sends no projectId to the client", async () => {
    const { result } = renderHook(() => useDeleteTrust(), {
      wrapper: makeWrapper(api, queryClient),
    });
    act(() => result.current.mutate());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.deleteTrust).toHaveBeenCalledWith();
  });
});
