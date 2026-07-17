// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SearchProvider } from "@/hooks/search-context";
import { ThemeProvider } from "@/hooks/theme-context";
import { stubMatchMedia } from "@/testing/match-media";
import { TuiShell } from "./tui-shell";
import { TuiTwoPane } from "./tui-two-pane";

// Boundary mock: TanStack Router is the external routing library used by the chrome bars.
vi.mock("@tanstack/react-router", async () => {
  const { RouterLinkMock } = await import("@/testing/router-mock");
  return {
    Link: RouterLinkMock,
    useRouterState: ({
      select,
    }: {
      select: (state: {
        location: { pathname: string };
        matches: Array<{ routeId: string; status: string }>;
      }) => unknown;
    }) =>
      select({
        location: { pathname: "/" },
        matches: [{ routeId: "/", status: "success" }],
      }),
    useNavigate: () => vi.fn(),
  };
});

function chromeWrappers() {
  const statusBar = screen.getByRole("navigation", { name: "Primary" }).parentElement;
  const footerBar = screen.getByRole("contentinfo").parentElement;
  const searchButton = screen.getByRole("button", { name: /^search docs/i });
  const commandRow = searchButton.parentElement?.parentElement ?? null;
  if (statusBar === null || commandRow === null || footerBar === null) {
    throw new Error("Expected shell chrome wrappers to render");
  }
  return { statusBar, commandRow, footerBar };
}

describe("TuiShell", () => {
  it("inerts the chrome rows while the mobile drawer is open and releases them on close", async () => {
    stubMatchMedia({ isDesktop: false });
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <KeyboardProvider>
          <SearchProvider>
            <TuiShell>
              <TuiTwoPane
                sidebar={() => (
                  <>
                    <a href="/ui">First sidebar item</a>
                    <a href="/keys">Last sidebar item</a>
                  </>
                )}
              >
                <p>Body</p>
              </TuiTwoPane>
            </TuiShell>
          </SearchProvider>
        </KeyboardProvider>
      </ThemeProvider>,
    );

    const menuButton = screen.getByRole("button", { name: /open navigation menu/i });
    const { statusBar, commandRow, footerBar } = chromeWrappers();
    expect(statusBar).not.toHaveAttribute("inert");
    expect(commandRow).not.toHaveAttribute("inert");
    expect(footerBar).not.toHaveAttribute("inert");

    await user.click(menuButton);

    expect(statusBar).toHaveAttribute("inert");
    expect(commandRow).toHaveAttribute("inert");
    expect(footerBar).toHaveAttribute("inert");

    const skipLink = screen.getByRole("link", { name: "Skip to content" });
    const firstSidebarLink = screen.getByRole("link", { name: "First sidebar item" });
    const lastSidebarLink = screen.getByRole("link", { name: "Last sidebar item" });
    const scrim = screen.getByRole("button", { name: /close sidebar navigation/i });
    expect(skipLink.closest("[inert]")).not.toBeNull();
    await waitFor(() => expect(firstSidebarLink).toHaveFocus());

    lastSidebarLink.focus();
    await user.tab();
    expect(scrim).toHaveFocus();
    await user.tab({ shift: true });
    expect(lastSidebarLink).toHaveFocus();

    skipLink.focus();
    await waitFor(() => expect(lastSidebarLink).toHaveFocus());

    await user.keyboard("{Escape}");

    expect(statusBar).not.toHaveAttribute("inert");
    expect(commandRow).not.toHaveAttribute("inert");
    expect(footerBar).not.toHaveAttribute("inert");
    expect(skipLink.closest("[inert]")).toBeNull();
    await waitFor(() => expect(menuButton).toHaveFocus());
  });
});
