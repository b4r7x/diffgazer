// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { toast } from "@diffgazer/ui/components/toast";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileNavProvider, useMobileNav } from "@/hooks/mobile-nav-context";
import { stubMatchMedia } from "@/testing/match-media";
import { SidebarChrome } from "./sidebar-chrome";

const routerBoundary = vi.hoisted(() => ({
  pathname: "/ui/components/button",
  navigate: vi.fn(),
  resolveSwitchPath: vi.fn(),
}));

// Boundary mock: @tanstack/react-router is the external route context boundary.
vi.mock("@tanstack/react-router", async () => {
  const { RouterLinkMock, useLocationMock, useRouterStateMock } = await import(
    "@/testing/router-mock"
  );
  return {
    Link: RouterLinkMock,
    ...useLocationMock({
      get pathname() {
        return routerBoundary.pathname;
      },
    }),
    ...useRouterStateMock({
      get pathname() {
        return routerBoundary.pathname;
      },
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
