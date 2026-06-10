// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { toast } from "@diffgazer/ui/components/toast";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileNavProvider, useMobileNav } from "@/lib/mobile-nav-context";
import { stubMatchMedia } from "@/testing/match-media";
import { SidebarChrome } from "./sidebar-chrome";

const routerBoundary = vi.hoisted(() => ({
  pathname: "/ui/components/button",
  navigate: vi.fn(),
  resolveSwitchPath: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
  const { RouterLinkMock } = await import("@/testing/router-mock");
  return {
    Link: RouterLinkMock,
    useLocation: ({ select }: { select: (location: { pathname: string }) => unknown }) =>
      select({ pathname: routerBoundary.pathname }),
    useNavigate: () => routerBoundary.navigate,
  };
});

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: () => ({
      handler: () => routerBoundary.resolveSwitchPath,
    }),
  }),
}));

vi.mock("@/lib/use-pending-docs-route", () => ({
  usePendingDocsRoute: () => null,
}));

vi.mock("@diffgazer/ui/components/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/generated/sections-with-index", () => ({
  SECTIONS_WITH_INDEX: new Set(["ui/components"]),
}));

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", TestResizeObserver);

function DrawerProbe() {
  const { open, setOpen } = useMobileNav();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open drawer
      </button>
      <span data-testid="drawer-state">{open ? "open" : "closed"}</span>
    </>
  );
}

function renderSidebarChrome() {
  return render(
    <MobileNavProvider>
      <DrawerProbe />
      <SidebarChrome library="ui" />
    </MobileNavProvider>,
  );
}

async function selectKeysLibrary(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox", { name: /select documentation library/i }));
  await user.click(await screen.findByRole("option", { name: "@diffgazer/keys" }));
}

describe("SidebarChrome library switching", () => {
  beforeEach(() => {
    routerBoundary.pathname = "/ui/components/button";
    routerBoundary.navigate.mockReset();
    routerBoundary.resolveSwitchPath.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("shows a toast and resets switching when the switch fails", async () => {
    stubMatchMedia({ isDesktop: true });
    Element.prototype.scrollIntoView = () => {};
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
    stubMatchMedia({ isDesktop: true });
    Element.prototype.scrollIntoView = () => {};
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
});

describe("SidebarChrome breadcrumbs", () => {
  beforeEach(() => {
    routerBoundary.pathname = "/ui/components/button";
    routerBoundary.navigate.mockReset();
  });

  it("closes the mobile drawer when a breadcrumb navigates", async () => {
    stubMatchMedia({ isDesktop: false });
    Element.prototype.scrollIntoView = () => {};
    const user = userEvent.setup();
    renderSidebarChrome();

    await user.click(screen.getByRole("button", { name: "Open drawer" }));
    expect(screen.getByTestId("drawer-state")).toHaveTextContent("open");

    await user.click(screen.getByRole("link", { name: "components" }));
    expect(screen.getByTestId("drawer-state")).toHaveTextContent("closed");
  });

  it("keeps the drawer open on modifier-clicks", async () => {
    stubMatchMedia({ isDesktop: false });
    Element.prototype.scrollIntoView = () => {};
    const user = userEvent.setup();
    renderSidebarChrome();

    await user.click(screen.getByRole("button", { name: "Open drawer" }));
    fireEvent.click(screen.getByRole("link", { name: "components" }), { ctrlKey: true });

    expect(screen.getByTestId("drawer-state")).toHaveTextContent("open");
  });
});
