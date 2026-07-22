/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderModelsResponse } from "../../schemas/config/index.js";
import { createTestQueryWrapper } from "../../testing/query-wrapper.js";
import type { BoundApi } from "../bound.js";
import {
  useDeleteProviderCredentials,
  useOpenRouterModels,
  useProviderModels,
  useSaveConfig,
} from "./config.js";
import { configQueries } from "./queries/config.js";

function makeResponse(id: string): ProviderModelsResponse {
  return {
    models: [{ id, name: id, description: id, tier: "free" }],
    fetchedAt: new Date().toISOString(),
    source: "live",
    cached: false,
  };
}

function makeWrapper(api: BoundApi) {
  return createTestQueryWrapper({ api }).Wrapper;
}

describe("useProviderModels", () => {
  let getProviderModels: ReturnType<typeof vi.fn>;
  let api: BoundApi;

  beforeEach(() => {
    getProviderModels = vi.fn(async (id: string) => makeResponse(id));
    api = { getProviderModels } as unknown as BoundApi;
  });

  it("does not fetch when disabled", () => {
    renderHook(() => useProviderModels("gemini", { enabled: false }), {
      wrapper: makeWrapper(api),
    });
    expect(getProviderModels).not.toHaveBeenCalled();
  });

  it("refetches with the new provider id across rerender", async () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: "gemini" | "groq" }) => useProviderModels(id),
      { wrapper: makeWrapper(api), initialProps: { id: "gemini" } },
    );
    await waitFor(() => expect(result.current.data?.models[0]?.id).toBe("gemini"));
    expect(result.current.isSuccess).toBe(true);
    rerender({ id: "groq" });
    await waitFor(() => expect(result.current.data?.models[0]?.id).toBe("groq"));
  });
});

describe("OpenRouter credential cache identity", () => {
  it("drops models fetched with the previous credential before the replacement refetch", async () => {
    const getOpenRouterModels = vi.fn(async () => {
      throw new Error("replacement credential rejected");
    });
    const saveConfig: BoundApi["saveConfig"] = vi.fn(async () => {});
    const harness = createTestQueryWrapper({
      api: { getOpenRouterModels, saveConfig },
    });
    harness.queryClient.setQueryData(configQueries.openRouterModels(harness.api).queryKey, {
      models: [
        {
          id: "old/model",
          name: "Old model",
          description: "Only valid for the old credential",
          contextLength: 4096,
          pricing: { prompt: "0", completion: "0" },
          isFree: true,
        },
      ],
      fetchedAt: new Date().toISOString(),
      cached: false,
    });

    const { result } = renderHook(
      () => ({ models: useOpenRouterModels(), save: useSaveConfig() }),
      { wrapper: harness.Wrapper },
    );
    expect(result.current.models.data?.models[0]?.id).toBe("old/model");

    await act(async () => {
      await result.current.save.mutateAsync({
        provider: "openrouter",
        apiKey: "replacement-key",
      });
    });

    await waitFor(() => expect(result.current.models.isError).toBe(true));
    expect(result.current.models.data).toBeUndefined();
    expect(result.current.models.error?.message).toBe("replacement credential rejected");
  });

  it("removes OpenRouter models after deleting its credential", async () => {
    const deleteProviderCredentials = vi.fn(async () => ({
      deleted: true,
      provider: "openrouter",
    }));
    const harness = createTestQueryWrapper({
      api: { deleteProviderCredentials } as Partial<BoundApi>,
    });
    const queryKey = configQueries.openRouterModels(harness.api).queryKey;
    harness.queryClient.setQueryData(queryKey, {
      models: [
        {
          id: "old/model",
          name: "Old model",
          contextLength: 4096,
          pricing: { prompt: "0", completion: "0" },
          isFree: true,
        },
      ],
      fetchedAt: new Date().toISOString(),
      cached: false,
    });

    const { result } = renderHook(
      () => ({
        models: useOpenRouterModels({ enabled: false }),
        deleteCredentials: useDeleteProviderCredentials(),
      }),
      { wrapper: harness.Wrapper },
    );

    expect(result.current.models.data?.models[0]?.id).toBe("old/model");

    await act(async () => {
      await result.current.deleteCredentials.mutateAsync("openrouter");
    });

    expect(deleteProviderCredentials).toHaveBeenCalledWith("openrouter");
    await waitFor(() => expect(result.current.models.data).toBeUndefined());
  });
});
