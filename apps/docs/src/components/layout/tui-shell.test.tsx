// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SearchProvider } from "@/lib/search-context";
import { stubMatchMedia } from "@/testing/match-media";
import { TuiShell } from "./tui-shell";
import { TuiTwoPane } from "./tui-two-pane";

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
  const commandRow = screen.getByRole("button", { name: /^search docs/i }).closest("div.contents");
  return { statusBar, commandRow, footerBar };
}

describe("TuiShell", () => {
  it("uses a dynamic viewport height root", () => {
    stubMatchMedia({ isDesktop: false });
    const { container } = render(
      <SearchProvider>
        <TuiShell>
          <p>Body</p>
        </TuiShell>
      </SearchProvider>,
    );

    const root = container.querySelector(".tui-chrome");
    expect(root).not.toBeNull();
    expect(root?.className).toContain("h-dvh");
    expect(root?.className).not.toContain("h-screen");
  });

  it("inerts the chrome rows while the mobile drawer is open and releases them on close", async () => {
    stubMatchMedia({ isDesktop: false });
    const user = userEvent.setup();

    render(
      <SearchProvider>
        <TuiShell>
          <TuiTwoPane sidebar={() => <a href="/ui">Sidebar item</a>}>
            <p>Body</p>
          </TuiTwoPane>
        </TuiShell>
      </SearchProvider>,
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
