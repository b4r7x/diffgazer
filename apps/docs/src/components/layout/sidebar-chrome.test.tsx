import { createDeferred } from "@diffgazer/core/testing/deferred";
import { toast } from "@diffgazer/ui/components/toast";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileNavProvider, useMobileNav } from "@/hooks/mobile-nav-context";
import { stubMatchMedia } from "@/testing/match-media";
import { SidebarChrome } from "./sidebar-chrome";

const routerBoundary = vi.hoisted(
  (): {
    pathname: string;
    pendingPathname: string | null;
    navigate: ReturnType<typeof vi.fn>;
    resolveSwitchPath: ReturnType<typeof vi.fn>;
  } => ({
    pathname: "/ui/components/button",
    pendingPathname: null,
    navigate: vi.fn(),
    resolveSwitchPath: vi.fn(),
  }),
);

// Boundary mock: @tanstack/react-router is the external route context boundary.
vi.mock("@tanstack/react-router", async () => {
  const { RouterLinkMock, useLocationMock } = await import("@/testing/router-mock");
  return {
    Link: RouterLinkMock,
    ...useLocationMock({
      get pathname() {
        return routerBoundary.pathname;
      },
    }),
    useRouterState: ({
      select,
    }: {
      select: (state: { isLoading: boolean; location: { pathname: string } }) => unknown;
    }) =>
      select({
        isLoading: routerBoundary.pendingPathname !== null,
        location: { pathname: routerBoundary.pendingPathname ?? routerBoundary.pathname },
      }),
    useNavigate: () => routerBoundary.navigate,
  };
});

// Boundary mock: @tanstack/react-start server functions are unavailable in jsdom.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: () => ({
      handler: () => routerBoundary.resolveSwitchPath,
    }),
  }),
}));

// Boundary mock: @diffgazer/ui toast is an external notification side-effect.
vi.mock("@diffgazer/ui/components/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Boundary mock: generated build artifact (jsdom has no @/generated data)
vi.mock("@/generated/sections-with-index", () => ({
  SECTIONS_WITH_INDEX: new Set(["ui/components"]),
}));

function DrawerProbe() {
  const { open, setOpen } = useMobileNav();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open drawer
      </button>
      <output aria-label="Drawer state">{open ? "open" : "closed"}</output>
    </>
  );
}

const TEST_TREE = {
  name: "Docs",
  children: [
    { type: "separator" as const, name: "Components" },
    { type: "page" as const, name: "Button", url: "/ui/components/button" },
  ],
};

function renderSidebarChrome() {
  const getUi = () => (
    <MobileNavProvider>
      <DrawerProbe />
      <SidebarChrome library="ui" tree={TEST_TREE} />
    </MobileNavProvider>
  );
  const view = render(getUi());
  return { ...view, rerenderSidebarChrome: () => view.rerender(getUi()) };
}

async function selectKeysLibrary(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox", { name: /select documentation library/i }));
  await user.click(await screen.findByRole("option", { name: "@diffgazer/keys" }));
}

describe("SidebarChrome library switching", () => {
  beforeEach(() => {
    routerBoundary.pathname = "/ui/components/button";
    routerBoundary.pendingPathname = null;
    routerBoundary.navigate.mockReset();
    routerBoundary.resolveSwitchPath.mockReset();
    vi.mocked(toast.error).mockReset();
    stubMatchMedia({ isDesktop: true });
    Element.prototype.scrollIntoView = () => {};
  });

  it("shows a toast and resets switching when the switch fails", async () => {
    routerBoundary.resolveSwitchPath.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    renderSidebarChrome();

    await selectKeysLibrary(user);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't switch library"));
    expect(routerBoundary.navigate).not.toHaveBeenCalled();
    expect(
      screen.getByRole("combobox", { name: /select documentation library/i }),
    ).not.toHaveAttribute("aria-disabled");
  });

  it("exposes aria-disabled while switching and ignores re-entrant switches", async () => {
    let resolveSwitch: (value: { library: string; slugs: string[] }) => void = () => {};
    routerBoundary.resolveSwitchPath.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSwitch = resolve;
        }),
    );
    const user = userEvent.setup();
    renderSidebarChrome();

    await selectKeysLibrary(user);

    const trigger = screen.getByRole("combobox", { name: /select documentation library/i });
    await waitFor(() => expect(trigger).toHaveAttribute("aria-disabled", "true"));

    await selectKeysLibrary(user);
    expect(routerBoundary.resolveSwitchPath).toHaveBeenCalledTimes(1);

    resolveSwitch({ library: "keys", slugs: ["getting-started"] });
    await waitFor(() => expect(routerBoundary.navigate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(trigger).not.toHaveAttribute("aria-disabled"));
  });

  it("keeps the busy state when a stale switch settles after a newer switch starts", async () => {
    const first = createDeferred<{ library: string; slugs: string[] }>();
    const second = createDeferred<{ library: string; slugs: string[] }>();
    routerBoundary.resolveSwitchPath
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const user = userEvent.setup();
    const { rerenderSidebarChrome } = renderSidebarChrome();

    await selectKeysLibrary(user);
    const trigger = screen.getByRole("combobox", { name: /select documentation library/i });
    await waitFor(() => expect(trigger).toHaveAttribute("aria-disabled", "true"));

    routerBoundary.pathname = "/ui/components/card";
    rerenderSidebarChrome();

    await user.click(screen.getByRole("combobox", { name: /select documentation library/i }));
    await user.click(await screen.findByRole("option", { name: "diffgazer" }));
    await waitFor(() => expect(trigger).toHaveAttribute("aria-disabled", "true"));

    await act(async () => {
      first.resolve({ library: "keys", slugs: ["getting-started"] });
      await first.promise;
    });

    expect(trigger).toHaveAttribute("aria-disabled", "true");
    expect(routerBoundary.resolveSwitchPath).toHaveBeenCalledTimes(2);

    await act(async () => {
      second.resolve({ library: "app", slugs: ["getting-started"] });
      await second.promise;
    });

    await waitFor(() => expect(routerBoundary.navigate).toHaveBeenCalledTimes(1));
  });

  it("ignores a late library response after the pathname changes", async () => {
    const deferred = createDeferred<{ library: string; slugs: string[] }>();
    routerBoundary.resolveSwitchPath.mockReturnValueOnce(deferred.promise);
    const user = userEvent.setup();
    const { rerenderSidebarChrome } = renderSidebarChrome();

    await selectKeysLibrary(user);
    routerBoundary.pathname = "/ui/components/card";
    rerenderSidebarChrome();

    await act(async () => {
      deferred.resolve({ library: "keys", slugs: ["getting-started"] });
      await deferred.promise;
    });

    expect(routerBoundary.navigate).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(
      screen.getByRole("combobox", { name: /select documentation library/i }),
    ).not.toHaveAttribute("aria-disabled");
  });

  it("ignores a late library failure after another route starts loading", async () => {
    const deferred = createDeferred<{ library: string; slugs: string[] }>();
    routerBoundary.resolveSwitchPath.mockReturnValueOnce(deferred.promise);
    const user = userEvent.setup();
    const { rerenderSidebarChrome } = renderSidebarChrome();

    await selectKeysLibrary(user);
    routerBoundary.pendingPathname = "/ui/components/card";
    rerenderSidebarChrome();

    await act(async () => {
      deferred.reject(new Error("stale failure"));
      await Promise.resolve();
    });

    expect(routerBoundary.navigate).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(
      screen.getByRole("combobox", { name: /select documentation library/i }),
    ).not.toHaveAttribute("aria-disabled");
  });

  it.each([
    "resolve",
    "reject",
  ] as const)("ignores a late %s after the sidebar unmounts", async (settlement) => {
    const deferred = createDeferred<{ library: string; slugs: string[] }>();
    routerBoundary.resolveSwitchPath.mockReturnValueOnce(deferred.promise);
    const user = userEvent.setup();
    const { unmount } = renderSidebarChrome();

    await selectKeysLibrary(user);
    unmount();

    await act(async () => {
      if (settlement === "resolve") {
        deferred.resolve({ library: "keys", slugs: ["getting-started"] });
      } else {
        deferred.reject(new Error("stale failure"));
      }
      await Promise.resolve();
    });

    expect(routerBoundary.navigate).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("SidebarChrome breadcrumbs", () => {
  beforeEach(() => {
    routerBoundary.pathname = "/ui/components/button";
    routerBoundary.pendingPathname = null;
    routerBoundary.navigate.mockReset();
  });

  it("closes the mobile drawer when a breadcrumb navigates", async () => {
    stubMatchMedia({ isDesktop: false });
    Element.prototype.scrollIntoView = () => {};
    const user = userEvent.setup();
    renderSidebarChrome();

    await user.click(screen.getByRole("button", { name: "Open drawer" }));
    expect(screen.getByRole("status", { name: "Drawer state" })).toHaveTextContent("open");

    await user.click(screen.getByRole("link", { name: "components" }));
    expect(screen.getByRole("status", { name: "Drawer state" })).toHaveTextContent("closed");
  });

  it("keeps the drawer open on modifier-clicks", async () => {
    stubMatchMedia({ isDesktop: false });
    Element.prototype.scrollIntoView = () => {};
    const user = userEvent.setup();
    renderSidebarChrome();

    await user.click(screen.getByRole("button", { name: "Open drawer" }));
    const link = screen.getByRole("link", { name: "components" });
    await user.keyboard("{Control>}");
    await user.click(link);
    await user.keyboard("{/Control}");

    expect(screen.getByRole("status", { name: "Drawer state" })).toHaveTextContent("open");
  });
});
