/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { SaveTrustRequest } from "../../schemas/config/index.js";
import { createTestQueryWrapper } from "../../testing/query-wrapper.js";
import type { BoundApi } from "../bound.js";
import type { TrustResponse } from "../types.js";
import { configQueries } from "./queries/config.js";
import { reviewQueries } from "./queries/review.js";
import { useDeleteTrust, useSaveTrust } from "./trust.js";

const SAVE_REQUEST: SaveTrustRequest = {
  capabilities: { readFiles: true },
  trustMode: "persistent",
};

describe("trust mutations", () => {
  let harness: ReturnType<typeof createTestQueryWrapper>;
  let deleteTrust: Mock<BoundApi["deleteTrust"]>;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    deleteTrust = vi.fn<BoundApi["deleteTrust"]>(async () => ({ removed: true }));
    harness = createTestQueryWrapper({
      api: {
        saveTrust: vi.fn(async () => ({}) as TrustResponse),
        deleteTrust,
      },
    });
    invalidateSpy = vi.spyOn(harness.queryClient, "invalidateQueries");
  });

  function invalidatedKeys(): unknown[][] {
    return invalidateSpy.mock.calls.map(
      ([arg]: [unknown]) => (arg as { queryKey: unknown[] }).queryKey,
    );
  }

  it("invalidates the init and review namespaces on grant", async () => {
    const { result } = renderHook(() => useSaveTrust(), { wrapper: harness.Wrapper });
    act(() => result.current.mutate(SAVE_REQUEST));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const keys = invalidatedKeys();
    expect(keys).toContainEqual(configQueries.init(harness.api).queryKey);
    expect(keys).toContainEqual(reviewQueries.all());
  });

  it("invalidates the init and review namespaces on revoke", async () => {
    const { result } = renderHook(() => useDeleteTrust(), { wrapper: harness.Wrapper });
    act(() => result.current.mutate());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const keys = invalidatedKeys();
    expect(keys).toContainEqual(configQueries.init(harness.api).queryKey);
    expect(keys).toContainEqual(reviewQueries.all());
  });

  it("revoke sends no projectId to the client", async () => {
    const { result } = renderHook(() => useDeleteTrust(), { wrapper: harness.Wrapper });
    act(() => result.current.mutate());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteTrust).toHaveBeenCalledWith();
  });
});
