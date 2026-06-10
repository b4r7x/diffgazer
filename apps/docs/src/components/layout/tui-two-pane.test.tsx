// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MobileNavProvider, useMobileNav } from "@/lib/mobile-nav-context";
import { stubControllableMatchMedia } from "@/testing/match-media";
import { TuiTwoPane } from "./tui-two-pane";

function MenuButton() {
  const { setOpen, menuButtonRef } = useMobileNav();
  return (
    <button ref={menuButtonRef} type="button" onClick={() => setOpen(true)}>
      Open menu
    </button>
  );
}

function renderTwoPane() {
  return render(
    <MobileNavProvider>
      <MenuButton />
      <TuiTwoPane sidebar={() => <a href="/ui">Sidebar item</a>}>
        <p>Body</p>
      </TuiTwoPane>
    </MobileNavProvider>,
  );
}

describe("TuiTwoPane", () => {
  it("ignores Escape keydowns that were already consumed", async () => {
    stubControllableMatchMedia({ isDesktop: false });
    const user = userEvent.setup();
    renderTwoPane();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("button", { name: /close sidebar navigation/i })).toBeInTheDocument();

    const consumedEscape = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    consumedEscape.preventDefault();
    act(() => {
      document.dispatchEvent(consumedEscape);
    });

    expect(screen.getByRole("button", { name: /close sidebar navigation/i })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("button", { name: /close sidebar navigation/i }),
    ).not.toBeInTheDocument();
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
    expect(
      screen.queryByRole("button", { name: /close sidebar navigation/i }),
    ).not.toBeInTheDocument();

    act(() => viewport.setDesktop(false));
    expect(menuButton).not.toHaveFocus();
  });
});
