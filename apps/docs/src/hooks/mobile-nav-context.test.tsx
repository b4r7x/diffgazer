// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { stubControllableMatchMedia, stubMatchMedia } from "@/testing/match-media";
import { MobileNavProvider, useMobileNav } from "./mobile-nav-context";

function Probe() {
  const { open, setOpen, isDesktop, sidebarEnabled, registerSidebar, unregisterSidebar } =
    useMobileNav();

  return (
    <div>
      <output aria-label="Drawer state">{open ? "open" : "closed"}</output>
      <output aria-label="Viewport state">{isDesktop ? "desktop" : "mobile"}</output>
      <output aria-label="Sidebar state">{sidebarEnabled ? "enabled" : "disabled"}</output>
      <button type="button" onClick={() => registerSidebar()}>
        Register sidebar
      </button>
      <button type="button" onClick={() => unregisterSidebar()}>
        Unregister sidebar
      </button>
      <button type="button" onClick={() => setOpen(true)}>
        Open sidebar
      </button>
    </div>
  );
}

describe("MobileNavProvider", () => {
  it("closes the mobile sidebar when the viewport returns to desktop", async () => {
    const viewport = stubControllableMatchMedia({ isDesktop: false });

    const user = userEvent.setup();
    render(
      <MobileNavProvider>
        <Probe />
      </MobileNavProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Register sidebar" }));
    await user.click(screen.getByRole("button", { name: "Open sidebar" }));
    expect(screen.getByRole("status", { name: "Drawer state" })).toHaveTextContent("open");

    act(() => {
      viewport.setDesktop(true);
    });

    expect(screen.getByRole("status", { name: "Drawer state" })).toHaveTextContent("closed");
    expect(screen.getByRole("status", { name: "Viewport state" })).toHaveTextContent("desktop");
  });

  it("closes and disables the sidebar when it unregisters while open", async () => {
    stubMatchMedia({ isDesktop: false });

    const user = userEvent.setup();
    render(
      <MobileNavProvider>
        <Probe />
      </MobileNavProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Register sidebar" }));
    await user.click(screen.getByRole("button", { name: "Open sidebar" }));
    expect(screen.getByRole("status", { name: "Drawer state" })).toHaveTextContent("open");
    expect(screen.getByRole("status", { name: "Sidebar state" })).toHaveTextContent("enabled");

    await user.click(screen.getByRole("button", { name: "Unregister sidebar" }));

    expect(screen.getByRole("status", { name: "Drawer state" })).toHaveTextContent("closed");
    expect(screen.getByRole("status", { name: "Sidebar state" })).toHaveTextContent("disabled");
  });
});
