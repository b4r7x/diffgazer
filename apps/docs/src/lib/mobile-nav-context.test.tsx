// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MobileNavProvider, useMobileNav } from "./mobile-nav-context";

const mediaListeners = new Set<() => void>();
let mediaMatches = true;

function setViewportDesktop(isDesktop: boolean) {
  mediaMatches = isDesktop;
  for (const listener of mediaListeners) {
    listener();
  }
}

function installMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: mediaMatches,
      media: query,
      onchange: null,
      addEventListener: (_event: string, listener: () => void) => {
        mediaListeners.add(listener);
      },
      removeEventListener: (_event: string, listener: () => void) => {
        mediaListeners.delete(listener);
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

function Probe() {
  const { open, setOpen, isDesktop, sidebarEnabled, registerSidebar } = useMobileNav();

  return (
    <div>
      <span data-testid="open">{open ? "open" : "closed"}</span>
      <span data-testid="desktop">{isDesktop ? "desktop" : "mobile"}</span>
      <span data-testid="sidebar">{sidebarEnabled ? "enabled" : "disabled"}</span>
      <button type="button" onClick={() => registerSidebar()}>
        Register sidebar
      </button>
      <button type="button" onClick={() => setOpen(true)}>
        Open sidebar
      </button>
    </div>
  );
}

describe("MobileNavProvider", () => {
  it("closes the mobile sidebar when the viewport returns to desktop", async () => {
    installMatchMedia();
    mediaListeners.clear();
    mediaMatches = false;

    const user = userEvent.setup();
    render(
      <MobileNavProvider>
        <Probe />
      </MobileNavProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Register sidebar" }));
    await user.click(screen.getByRole("button", { name: "Open sidebar" }));
    expect(screen.getByTestId("open")).toHaveTextContent("open");

    act(() => {
      setViewportDesktop(true);
    });

    expect(screen.getByTestId("open")).toHaveTextContent("closed");
    expect(screen.getByTestId("desktop")).toHaveTextContent("desktop");
  });
});
