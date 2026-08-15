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

/**
 * One user-visible control per chrome row. The `inert` flag lives on an
 * anonymous wrapper, so the contract is asserted from the control outwards
 * (`closest("[inert]")`) rather than by counting markup depth.
 */
function chromeControls() {
  return {
    statusBar: screen.getByRole("navigation", { name: "Site" }),
    commandRow: screen.getByRole("button", { name: /^search docs/i }),
    footerBar: screen.getByRole("contentinfo"),
  };
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
    const { statusBar, commandRow, footerBar } = chromeControls();
    expect(statusBar.closest("[inert]")).toBeNull();
    expect(commandRow.closest("[inert]")).toBeNull();
    expect(footerBar.closest("[inert]")).toBeNull();

    await user.click(menuButton);

    expect(statusBar.closest("[inert]")).not.toBeNull();
    expect(commandRow.closest("[inert]")).not.toBeNull();
    expect(footerBar.closest("[inert]")).not.toBeNull();

    const skipLink = screen.getByRole("link", { name: "Skip to content" });
    const firstSidebarLink = screen.getByRole("link", { name: "First sidebar item" });
    const lastSidebarLink = screen.getByRole("link", { name: "Last sidebar item" });
    const scrim = screen.getByRole("button", { name: /close sidebar navigation/i });
    expect(skipLink.closest("[inert]")).not.toBeNull();
    const sidebarRegion = screen.getByRole("complementary", { name: "Sidebar navigation" });
    await waitFor(() => expect(sidebarRegion).toHaveFocus());
    expect(firstSidebarLink).not.toHaveFocus();

    await user.tab();
    expect(firstSidebarLink).toHaveFocus();

    lastSidebarLink.focus();
    await user.tab();
    expect(scrim).toHaveFocus();
    await user.tab({ shift: true });
    expect(lastSidebarLink).toHaveFocus();

    skipLink.focus();
    await waitFor(() => expect(lastSidebarLink).toHaveFocus());

    await user.keyboard("{Escape}");

    expect(statusBar.closest("[inert]")).toBeNull();
    expect(commandRow.closest("[inert]")).toBeNull();
    expect(footerBar.closest("[inert]")).toBeNull();
    expect(skipLink.closest("[inert]")).toBeNull();
    await waitFor(() => expect(menuButton).toHaveFocus());
  });
});
