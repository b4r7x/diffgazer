// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { KeyboardProvider } from "@diffgazer/keys";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MobileNavProvider, useMobileNav } from "@/hooks/mobile-nav-context";
import { stubControllableMatchMedia } from "@/testing/match-media";
import { TuiTwoPane, type TuiTwoPaneProps } from "./tui-two-pane";

function MenuButton() {
  const { setOpen, menuButtonRef } = useMobileNav();
  return (
    <button ref={menuButtonRef} type="button" onClick={() => setOpen(true)}>
      Open menu
    </button>
  );
}

function renderTwoPane(props: Partial<TuiTwoPaneProps> = {}) {
  return render(
    <KeyboardProvider>
      <MobileNavProvider>
        <MenuButton />
        <TuiTwoPane sidebar={() => <a href="/ui">Sidebar item</a>} {...props}>
          <p>Body</p>
        </TuiTwoPane>
      </MobileNavProvider>
    </KeyboardProvider>,
  );
}

const scrim = () => screen.getByRole("button", { name: /close sidebar navigation/i });
const sidebar = () => screen.getByRole("complementary", { name: "Sidebar navigation" });

describe("TuiTwoPane", () => {
  it("keeps the scrim mounted and inert while the drawer is closed", async () => {
    stubControllableMatchMedia({ isDesktop: false });
    const user = userEvent.setup();
    renderTwoPane();

    expect(scrim()).toBeInTheDocument();
    expect(scrim()).toHaveAttribute("inert");
    expect(sidebar()).toHaveAttribute("inert");

    await user.click(screen.getByRole("button", { name: "Open menu" }));

    expect(scrim()).toBeInTheDocument();
    expect(scrim()).not.toHaveAttribute("inert");
    expect(sidebar()).not.toHaveAttribute("inert");
  });

  it("ignores Escape keydowns that were already consumed", async () => {
    stubControllableMatchMedia({ isDesktop: false });
    const user = userEvent.setup();
    renderTwoPane();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(scrim()).not.toHaveAttribute("inert");

    const consumedEscape = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    consumedEscape.preventDefault();
    act(() => {
      document.dispatchEvent(consumedEscape);
    });

    expect(scrim()).not.toHaveAttribute("inert");

    await user.keyboard("{Escape}");

    expect(scrim()).toHaveAttribute("inert");
    expect(sidebar()).toHaveAttribute("inert");
    await waitFor(() => expect(screen.getByRole("button", { name: "Open menu" })).toHaveFocus());
  });

  it("does not steal focus on return to mobile after the drawer was closed by a desktop resize", async () => {
    const viewport = stubControllableMatchMedia({ isDesktop: false });
    const user = userEvent.setup();
    renderTwoPane();

    const menuButton = screen.getByRole("button", { name: "Open menu" });
    await user.click(menuButton);
    await waitFor(() => expect(screen.getByRole("link", { name: "Sidebar item" })).toHaveFocus());

    act(() => viewport.setDesktop(true));
    expect(scrim()).toHaveAttribute("inert");

    act(() => viewport.setDesktop(false));
    expect(menuButton).not.toHaveFocus();
  });

  it("marks the sidebar navigation region as busy when sidebarBusy is true", () => {
    stubControllableMatchMedia({ isDesktop: true });
    renderTwoPane({ sidebarBusy: true });

    expect(sidebar()).toHaveAttribute("aria-busy", "true");
  });
});
