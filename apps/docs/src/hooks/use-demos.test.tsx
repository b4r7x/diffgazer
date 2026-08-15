import { createDeferred } from "@diffgazer/core/testing/deferred";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  type ComponentType,
  type LazyExoticComponent,
  lazy,
  Profiler,
  type ProfilerOnRenderCallback,
  type PropsWithChildren,
} from "react";
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

    expect(result.current).toEqual({
      demos: {},
      isLoading: true,
      loadError: null,
      retry: expect.any(Function),
    });

    act(() => {
      load.resolve({ demos: { example: Demo } });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.demos.example).toBe(Demo);
    expect(result.current.loadError).toBeNull();
  });

  it("surfaces an index load failure instead of collapsing it into an empty ready state", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const failure = new Error("demo index failed");
    loaders.ui.mockRejectedValue(failure);

    const { result } = renderHook(() => useDemos("ui"));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.demos).toEqual({});
    expect(result.current.loadError).toEqual(failure);
  });

  it("retries the index import when retry is called after a failure", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const Demo = lazy(async () => ({ default: () => null }));
    loaders.ui.mockRejectedValueOnce(new Error("demo index failed"));
    loaders.ui.mockResolvedValueOnce({ demos: { example: Demo } });

    const { result } = renderHook(() => useDemos("ui"));

    await waitFor(() => expect(result.current.loadError).toBeInstanceOf(Error));

    act(() => {
      result.current.retry();
    });

    await waitFor(() => expect(result.current.demos.example).toBe(Demo));
    expect(result.current.loadError).toBeNull();
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

    expect(result.current).toEqual({
      demos: {},
      isLoading: true,
      loadError: null,
      retry: expect.any(Function),
    });
  });

  it("ignores a stale library load after switching to another library", async () => {
    const uiLoad = createDeferred<{ demos: TestDemoMap }>();
    const keysLoad = createDeferred<{ demos: TestDemoMap }>();
    const UiDemo = lazy(async () => ({ default: () => null }));
    const KeysDemo = lazy(async () => ({ default: () => null }));
    loaders.ui.mockReturnValue(uiLoad.promise);
    loaders.keys.mockReturnValue(keysLoad.promise);
    const commits: string[] = [];
    const onRender: ProfilerOnRenderCallback = (_id, phase) => {
      commits.push(phase);
    };
    const wrapper = ({ children }: PropsWithChildren) => (
      <Profiler id="use-demos-race" onRender={onRender}>
        {children}
      </Profiler>
    );

    const { result, rerender } = renderHook(({ library }) => useDemos(library), {
      initialProps: { library: "ui" },
      wrapper,
    });

    expect(loaders.ui).toHaveBeenCalledTimes(1);
    const uiRequestOrder = loaders.ui.mock.invocationCallOrder[0];
    if (uiRequestOrder === undefined) {
      throw new Error("The UI demo request did not start");
    }

    rerender({ library: "keys" });

    expect(loaders.keys).toHaveBeenCalledTimes(1);
    const keysRequestOrder = loaders.keys.mock.invocationCallOrder[0];
    if (keysRequestOrder === undefined) {
      throw new Error("The keys demo request did not start");
    }
    expect(keysRequestOrder).toBeGreaterThan(uiRequestOrder);
    const commitsBeforeStaleResolution = commits.length;

    await act(async () => {
      uiLoad.resolve({ demos: { ui: UiDemo } });
      await uiLoad.promise;
    });

    expect(commits).toHaveLength(commitsBeforeStaleResolution);

    expect(result.current).toEqual({
      demos: {},
      isLoading: true,
      loadError: null,
      retry: expect.any(Function),
    });

    await act(async () => {
      keysLoad.resolve({ demos: { keys: KeysDemo } });
      await keysLoad.promise;
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.demos).toEqual({ keys: KeysDemo });
    expect(result.current.demos).not.toHaveProperty("ui");
    expect(result.current.loadError).toBeNull();
  });
});
