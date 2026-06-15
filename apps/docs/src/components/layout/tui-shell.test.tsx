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
      select: (state: { location: { pathname: string } }) => unknown;
    }) => select({ location: { pathname: "/" } }),
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
              <TuiTwoPane sidebar={() => <a href="/ui">Sidebar item</a>}>
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

    await user.keyboard("{Escape}");

    expect(statusBar).not.toHaveAttribute("inert");
    expect(commandRow).not.toHaveAttribute("inert");
    expect(footerBar).not.toHaveAttribute("inert");
    await waitFor(() => expect(menuButton).toHaveFocus());
  });
});
