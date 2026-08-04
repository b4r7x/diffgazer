// @vitest-environment jsdom

import { createDeferred } from "@diffgazer/core/testing/deferred";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ComponentType, type LazyExoticComponent, lazy } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDemos } from "./use-demos";

const loaders = vi.hoisted(() => ({
  ui: vi.fn(),
  keys: vi.fn(),
}));

vi.mock("@/generated/demo-loaders", () => ({
  demoLoaders: {
    ui: loaders.ui,
    keys: loaders.keys,
  },
}));

type TestDemoMap = Record<string, LazyExoticComponent<ComponentType>>;

describe("useDemos", () => {
  beforeEach(() => {
    loaders.ui.mockReset();
    loaders.keys.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports loading on the first render and exposes demos after the index resolves", async () => {
    const load = createDeferred<{ demos: TestDemoMap }>();
    const Demo = lazy(async () => ({ default: () => null }));
    loaders.ui.mockReturnValue(load.promise);

    const { result } = renderHook(() => useDemos("ui"));

    expect(result.current).toEqual({ demos: {}, isLoading: true });

    act(() => {
      load.resolve({ demos: { example: Demo } });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.demos.example).toBe(Demo);
  });

  it("falls back to no demos when the loader rejects", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    loaders.ui.mockRejectedValue(new Error("demo index failed"));

    const { result } = renderHook(() => useDemos("ui"));

    expect(result.current).toEqual({ demos: {}, isLoading: true });

    await waitFor(() => expect(result.current).toEqual({ demos: {}, isLoading: false }));
  });

  it("never exposes the previous library's demos while the next index loads", async () => {
    const uiLoad = createDeferred<{ demos: TestDemoMap }>();
    const keysLoad = createDeferred<{ demos: TestDemoMap }>();
    const UiDemo = lazy(async () => ({ default: () => null }));
    loaders.ui.mockReturnValue(uiLoad.promise);
    loaders.keys.mockReturnValue(keysLoad.promise);

    const { result, rerender } = renderHook(({ library }) => useDemos(library), {
      initialProps: { library: "ui" },
    });

    act(() => {
      uiLoad.resolve({ demos: { ui: UiDemo } });
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({ library: "keys" });

    expect(result.current).toEqual({ demos: {}, isLoading: true });
  });
});
