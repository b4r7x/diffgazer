/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BoundApi } from "../bound.js";
import { ApiProvider } from "./context.js";
import { reviewQueries } from "./queries/review.js";
import { useRefreshReviewContext } from "./review.js";

function makeWrapper(api: BoundApi, queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ApiProvider, { value: api }, children),
    );
}

describe("useRefreshReviewContext", () => {
  let api: BoundApi;
  let queryClient: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    api = {
      refreshReviewContext: vi.fn(async () => ({ context: undefined })),
    } as unknown as BoundApi;
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  });

  it("invalidates the active context query key", async () => {
    const { result } = renderHook(() => useRefreshReviewContext(), {
      wrapper: makeWrapper(api, queryClient),
    });
    act(() => result.current.mutate(undefined));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const keys = invalidateSpy.mock.calls.map(
      ([arg]: [unknown]) => (arg as { queryKey: unknown[] }).queryKey,
    );
    expect(keys).toContainEqual(reviewQueries.context(api).queryKey);
    expect(reviewQueries.context(api).queryKey).toEqual(["review", "context"]);
  });
});
