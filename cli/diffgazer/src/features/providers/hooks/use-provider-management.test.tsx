/**
 * @vitest-environment jsdom
 */
import { type BoundApi, createApi } from "@diffgazer/core/api";
import { getProviderRowId } from "@diffgazer/core/providers";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import {
  buildProviderRows,
  READY_GEMINI_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useProviderManagement } from "./use-provider-management";

const GEMINI_INPUT = {
  transportFamily: "hosted-api",
  productId: "gemini",
  endpoint: READY_GEMINI_CONFIGURATION.endpoint,
  credential: { kind: "environment" },
} as const;

function renderManagement(api: BoundApi) {
  const { Wrapper } = createTestQueryWrapper({ api });
  const providers = buildProviderRows();
  const geminiRow = providers.find((row) => row.product.productId === "gemini");
  if (!geminiRow) throw new Error("Provider fixtures are missing the Gemini row");
  return {
    geminiRowId: getProviderRowId(geminiRow),
    hook: renderHook(() => useProviderManagement(providers), { wrapper: Wrapper }),
  };
}

describe("useProviderManagement single flight", () => {
  it("dispatches one create for two activations in the same frame", async () => {
    const deferred = createDeferred<Awaited<ReturnType<BoundApi["createConfiguration"]>>>();
    const createConfiguration = vi
      .fn<BoundApi["createConfiguration"]>()
      .mockReturnValue(deferred.promise);
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      createConfiguration,
    } satisfies BoundApi;
    const { geminiRowId, hook } = renderManagement(api);
    const owner = { kind: "setup", id: 1, rowId: geminiRowId } as const;

    await act(async () => {
      void hook.result.current.handleCreateConfiguration(owner, GEMINI_INPUT);
      void hook.result.current.handleCreateConfiguration(owner, GEMINI_INPUT);
    });

    expect(createConfiguration).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve({ action: "create", status: "succeeded" } as Awaited<
        ReturnType<BoundApi["createConfiguration"]>
      >);
    });
  });

  it("propagates a rejected model selection to the overlay", async () => {
    const selectConfiguration = vi
      .fn<BoundApi["selectConfiguration"]>()
      .mockRejectedValue(new Error("select rejected"));
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      selectConfiguration,
    } satisfies BoundApi;
    const { geminiRowId, hook } = renderManagement(api);
    const owner = {
      kind: "model",
      id: 1,
      rowId: geminiRowId,
      configurationId: READY_GEMINI_CONFIGURATION.configurationId,
    } as const;

    await expect(
      act(async () => {
        await hook.result.current.handleSelectModel(owner, "gemini-2.5-flash");
      }),
    ).rejects.toThrow("select rejected");
  });
});
