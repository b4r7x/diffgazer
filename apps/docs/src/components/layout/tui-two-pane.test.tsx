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

function DrawerState() {
  const { open } = useMobileNav();
  return <output aria-label="Drawer state">{open ? "open" : "closed"}</output>;
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
    await waitFor(() => expect(sidebar()).toHaveFocus());

    act(() => viewport.setDesktop(true));
    expect(scrim()).toHaveAttribute("inert");

    act(() => viewport.setDesktop(false));
    expect(menuButton).not.toHaveFocus();
  });

  it("leaves focus alone when the viewport reaches desktop and the reader is elsewhere", async () => {
    const viewport = stubControllableMatchMedia({ isDesktop: false });
    const user = userEvent.setup();
    renderTwoPane();

    const menuButton = screen.getByRole("button", { name: "Open menu" });
    await user.click(menuButton);
    await waitFor(() => expect(sidebar()).toHaveFocus());

    await user.keyboard("{Escape}");
    await waitFor(() => expect(menuButton).toHaveFocus());

    const elsewhere = document.createElement("button");
    document.body.append(elsewhere);
    elsewhere.focus();

    act(() => viewport.setDesktop(true));

    expect(elsewhere).toHaveFocus();
    elsewhere.remove();
  });

  it("closes the drawer when the pane unmounts so a sidebar-less surface never inherits it", async () => {
    stubControllableMatchMedia({ isDesktop: false });
    const user = userEvent.setup();

    function Harness({ withPane }: { withPane: boolean }) {
      return (
        <KeyboardProvider>
          <MobileNavProvider>
            <MenuButton />
            <DrawerState />
            {withPane ? (
              <TuiTwoPane sidebar={() => <a href="/ui">Sidebar item</a>}>
                <p>Body</p>
              </TuiTwoPane>
            ) : null}
          </MobileNavProvider>
        </KeyboardProvider>
      );
    }

    const { rerender } = render(<Harness withPane />);
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("status", { name: "Drawer state" })).toHaveTextContent("open");

    rerender(<Harness withPane={false} />);

    expect(screen.getByRole("status", { name: "Drawer state" })).toHaveTextContent("closed");
  });

  it("marks the sidebar navigation region as busy when sidebarBusy is true", () => {
    stubControllableMatchMedia({ isDesktop: true });
    renderTwoPane({ sidebarBusy: true });

    expect(sidebar()).toHaveAttribute("aria-busy", "true");
  });
});
