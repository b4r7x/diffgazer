import { createDeferred } from "@diffgazer/core/testing/deferred";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Profiler, type ProfilerOnRenderCallback, StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HookDataMap } from "@/lib/generated-doc-data";

const loadLibraryHooksData = vi.hoisted(() => vi.fn<(library: string) => Promise<HookDataMap>>());

vi.mock("@/lib/load-hooks-data", () => ({ loadLibraryHooksData }));

import { LibraryHookSource } from "./hook-source";

describe("LibraryHookSource", () => {
  let loadActualLibraryHooksData: (library: string) => Promise<HookDataMap>;

  function UnmountHarness({
    show,
    library = "keys",
    onRender,
  }: {
    show: boolean;
    library?: string;
    onRender: ProfilerOnRenderCallback;
  }) {
    return (
      <Profiler id="library-hook-source" onRender={onRender}>
        {show ? (
          <LibraryHookSource library={library} sectionTitle="Standalone Hooks" hint="copy these" />
        ) : (
          <span data-testid="retained-observer">retained</span>
        )}
      </Profiler>
    );
  }

  beforeEach(async () => {
    const actual =
      await vi.importActual<typeof import("@/lib/load-hooks-data")>("@/lib/load-hooks-data");
    loadActualLibraryHooksData = actual.loadLibraryHooksData;
    loadLibraryHooksData.mockReset();
    loadLibraryHooksData.mockImplementation(loadActualLibraryHooksData);
  });

  it("lists every library hook through the shared disclosure", async () => {
    render(<LibraryHookSource library="keys" sectionTitle="Standalone Hooks" hint="copy these" />);

    expect(await screen.findByRole("heading", { name: "Standalone Hooks" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /useNavigation source \(8 files\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /useFocusRestore source \(3 files\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /useFocusTrap source \(6 files\)/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "@hooks/use-scroll-lock.ts" })).toBeInTheDocument();
  });

  it("reveals a hook's source files through its disclosure", async () => {
    const user = userEvent.setup();
    render(<LibraryHookSource library="keys" sectionTitle="Standalone Hooks" hint="copy these" />);

    const trigger = await screen.findByRole("button", {
      name: /useNavigation source \(8 files\)/i,
    });
    expect(
      screen.getByText("Standalone keyboard navigation for role-based lists and tabs"),
    ).toBeInTheDocument();

    await user.click(trigger);

    expect(screen.getByText("@hooks/use-navigation.ts")).toBeInTheDocument();
    expect(screen.getByText("@hooks/utils/navigation-dispatch.ts")).toBeInTheDocument();
  });

  it("surfaces a rejected loader and recovers after retry", async () => {
    const failure = new Error("hook index failed");
    const keys = await loadActualLibraryHooksData("keys");
    loadLibraryHooksData.mockRejectedValueOnce(failure).mockResolvedValueOnce(keys);

    const user = userEvent.setup();
    render(<LibraryHookSource library="keys" sectionTitle="Standalone Hooks" hint="copy these" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Hook source could not be loaded.");

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("heading", { name: "Standalone Hooks" })).toBeInTheDocument();
    expect(loadLibraryHooksData).toHaveBeenCalledTimes(2);
  });

  it.each([
    "resolve",
    "reject",
  ] as const)("ignores a late %s after the source view unmounts", async (settlement) => {
    const request = createDeferred<HookDataMap>();
    const commits: string[] = [];
    const onRender: ProfilerOnRenderCallback = (_id, phase) => {
      commits.push(phase);
    };
    loadLibraryHooksData.mockImplementation((library) =>
      library === "keys" ? request.promise : Promise.resolve({}),
    );
    const view = render(
      <StrictMode>
        <UnmountHarness show onRender={onRender} />
      </StrictMode>,
    );
    // Keep the observer mounted while the source view is removed so a stale setter cannot hide a commit.
    view.rerender(
      <StrictMode>
        <UnmountHarness show library="missing" onRender={onRender} />
      </StrictMode>,
    );

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    const commitsBeforeLateResolution = commits.length;

    await act(async () => {
      if (settlement === "resolve") {
        request.resolve(await loadActualLibraryHooksData("keys"));
      } else {
        request.reject(new Error("stale failure"));
      }
      await Promise.resolve();
    });

    expect(commits).toHaveLength(commitsBeforeLateResolution);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    view.rerender(
      <StrictMode>
        <UnmountHarness show={false} onRender={onRender} />
      </StrictMode>,
    );
    expect(screen.getByTestId("retained-observer")).toBeInTheDocument();
    view.unmount();
  });

  it("does not show stale hook data while switching libraries", async () => {
    const ui = await loadActualLibraryHooksData("ui");
    const keys = await loadActualLibraryHooksData("keys");
    const uiRequest = createDeferred<HookDataMap>();
    const keysRequest = createDeferred<HookDataMap>();
    loadLibraryHooksData.mockImplementation((library) =>
      library === "ui" ? uiRequest.promise : keysRequest.promise,
    );

    const { rerender } = render(
      <LibraryHookSource library="ui" sectionTitle="UI Hooks" hint="copy these" />,
    );
    rerender(<LibraryHookSource library="keys" sectionTitle="Keys Hooks" hint="copy these" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading hook source...");

    await act(async () => {
      uiRequest.resolve(ui);
      await uiRequest.promise;
    });
    expect(screen.getByRole("status")).toHaveTextContent("Loading hook source...");
    expect(
      screen.queryByRole("button", { name: /Controllable State source/i }),
    ).not.toBeInTheDocument();

    await act(async () => {
      keysRequest.resolve(keys);
      await keysRequest.promise;
    });
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Keys Hooks" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /useNavigation source/i })).toBeInTheDocument();
  });

  it("keeps the current library ready when a stale success resolves last", async () => {
    const ui = await loadActualLibraryHooksData("ui");
    const keys = await loadActualLibraryHooksData("keys");
    const uiRequest = createDeferred<HookDataMap>();
    const keysRequest = createDeferred<HookDataMap>();
    loadLibraryHooksData.mockImplementation((library) =>
      library === "ui" ? uiRequest.promise : keysRequest.promise,
    );

    const { rerender } = render(
      <LibraryHookSource library="ui" sectionTitle="UI Hooks" hint="copy these" />,
    );
    rerender(<LibraryHookSource library="keys" sectionTitle="Keys Hooks" hint="copy these" />);

    await act(async () => {
      keysRequest.resolve(keys);
      await keysRequest.promise;
    });
    expect(await screen.findByRole("heading", { name: "Keys Hooks" })).toBeInTheDocument();

    await act(async () => {
      uiRequest.resolve(ui);
      await uiRequest.promise;
    });

    expect(screen.getByRole("heading", { name: "Keys Hooks" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Controllable State source/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps the current library ready when a stale rejection resolves last", async () => {
    const keys = await loadActualLibraryHooksData("keys");
    const uiRequest = createDeferred<HookDataMap>();
    const keysRequest = createDeferred<HookDataMap>();
    loadLibraryHooksData.mockImplementation((library) =>
      library === "ui" ? uiRequest.promise : keysRequest.promise,
    );

    const { rerender } = render(
      <LibraryHookSource library="ui" sectionTitle="UI Hooks" hint="copy these" />,
    );
    rerender(<LibraryHookSource library="keys" sectionTitle="Keys Hooks" hint="copy these" />);

    await act(async () => {
      keysRequest.resolve(keys);
      await keysRequest.promise;
    });
    expect(await screen.findByRole("heading", { name: "Keys Hooks" })).toBeInTheDocument();

    const failure = new Error("stale UI request failed");
    await act(async () => {
      uiRequest.reject(failure);
      await expect(uiRequest.promise).rejects.toBe(failure);
    });

    expect(screen.getByRole("heading", { name: "Keys Hooks" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
