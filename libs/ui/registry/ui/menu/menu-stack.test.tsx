import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { Menu, type MenuSubMode } from "./index";

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

/** Makes every listed media query report a match, leaving the rest false. */
function stubMatchMedia(matching: string[]) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: matching.includes(query),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function renderMenu(props: { mode?: MenuSubMode; onClose?: () => void } = {}) {
  return render(
    <Menu aria-label="Test menu" defaultHighlighted="new" onClose={props.onClose}>
      <Menu.Item id="new">New File</Menu.Item>
      <Menu.Item id="open">Open File</Menu.Item>
      <Menu.Sub mode={props.mode ?? "stack"}>
        <Menu.SubTrigger id="edit">Edit</Menu.SubTrigger>
        <Menu.SubContent>
          <Menu.Item id="undo">Undo</Menu.Item>
          <Menu.Item id="redo">Redo</Menu.Item>
        </Menu.SubContent>
      </Menu.Sub>
    </Menu>,
  );
}

/** Public ids of every menu item currently in the accessibility tree, in order. */
function menuItemIds(): string[] {
  return within(screen.getByRole("menu"))
    .queryAllByRole("menuitem")
    .map((item) => item.getAttribute("data-value") ?? "");
}

async function drillIn(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("menuitem", { name: "Edit" }));
  await waitFor(() => expect(screen.getByRole("menuitem", { name: "Undo" })).toBeInTheDocument());
}

describe("Menu drill-down stack", () => {
  it("pushes on ArrowRight and highlights the first submenu item", async () => {
    const user = userEvent.setup();
    renderMenu();

    screen.getByRole("menu").focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowRight}");
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Undo" })).toBeInTheDocument());

    expect(screen.getByRole("menu")).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("menuitem", { name: "Undo" }).id,
    );
  });

  it("removes the parent items from the accessibility tree while drilled in", async () => {
    const user = userEvent.setup();
    renderMenu();

    expect(menuItemIds()).toEqual(["new", "open", "edit"]);

    await drillIn(user);

    expect(menuItemIds()).toEqual(["__menu-stack-back", "undo", "redo"]);
    expect(screen.queryByRole("menuitem", { name: "New File" })).not.toBeInTheDocument();
  });

  it("keeps typeahead and arrow wrapping off the hidden parent items", async () => {
    const user = userEvent.setup();
    renderMenu();
    await drillIn(user);
    const menu = screen.getByRole("menu");

    // "n" would match "New File" if the hidden parent list were still collected.
    await user.keyboard("n");
    expect(menu).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("menuitem", { name: "Undo" }).id,
    );

    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(menu).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("menuitem", { name: /Back to/ }).id,
    );
  });

  it("hovers the back row under the pointer without moving the keyboard cursor", async () => {
    const user = userEvent.setup();
    renderMenu();
    await drillIn(user);
    const menu = screen.getByRole("menu");
    const backRow = screen.getByRole("menuitem", { name: /Back to/ });

    // The click that drilled in already recorded the pointer's position, so the
    // back row appearing under the resting cursor must NOT arm the hover...
    await user.hover(backRow);
    expect(backRow).not.toHaveAttribute("data-hovered");

    // ...only real travel does.
    // fireEvent retained: user-event cannot dispatch pointermove with controlled
    // coordinates, which is exactly what the stationary-pointer gate keys on.
    fireEvent.pointerMove(backRow, { clientX: 12, clientY: 11 });

    expect(backRow).toHaveAttribute("data-hovered");
    expect(backRow).not.toHaveAttribute("data-highlighted");
    // Hover stays cosmetic: the cursor keeps pointing where drill-in left it.
    expect(menu).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("menuitem", { name: "Undo" }).id,
    );
  });

  it("pops on ArrowLeft and restores the highlight to the trigger", async () => {
    const user = userEvent.setup();
    renderMenu();
    await drillIn(user);

    await user.keyboard("{ArrowLeft}");

    await waitFor(() => expect(menuItemIds()).toEqual(["new", "open", "edit"]));
    expect(screen.getByRole("menu")).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("menuitem", { name: "Edit" }).id,
    );
    expect(screen.getByRole("menuitem", { name: "Edit" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("pops on Escape without closing the menu", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderMenu({ onClose });
    await drillIn(user);

    await user.keyboard("{Escape}");

    await waitFor(() => expect(menuItemIds()).toEqual(["new", "open", "edit"]));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes the menu when Escape is pressed at the root level", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderMenu({ onClose });

    screen.getByRole("menu").focus();
    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("gives the back row an accessible name and activates it by click and by Enter", async () => {
    const user = userEvent.setup();
    renderMenu();
    await drillIn(user);

    const back = screen.getByRole("menuitem", { name: "Back to Edit" });
    await user.click(back);
    await waitFor(() => expect(menuItemIds()).toEqual(["new", "open", "edit"]));

    await drillIn(user);
    await user.keyboard("{ArrowUp}{Enter}");
    await waitFor(() => expect(menuItemIds()).toEqual(["new", "open", "edit"]));
  });

  it("has no axe violations while drilled in", async () => {
    const user = userEvent.setup();
    const { container } = renderMenu();
    await drillIn(user);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Menu.Sub auto mode", () => {
  it("resolves to the stack at coarse pointer", async () => {
    stubMatchMedia(["(pointer: coarse)"]);
    const user = userEvent.setup();
    renderMenu({ mode: "auto" });

    await drillIn(user);

    expect(screen.getByRole("menuitem", { name: "Back to Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "New File" })).not.toBeInTheDocument();
  });

  it("resolves to the stack on a narrow viewport", async () => {
    stubMatchMedia(["(max-width: 639px)"]);
    const user = userEvent.setup();
    renderMenu({ mode: "auto" });

    await drillIn(user);

    expect(screen.getByRole("menuitem", { name: "Back to Edit" })).toBeInTheDocument();
  });

  it("stays a flyout on a fine pointer at a wide viewport", async () => {
    stubMatchMedia([]);
    const user = userEvent.setup();
    renderMenu({ mode: "auto" });

    await drillIn(user);

    expect(screen.queryByRole("menuitem", { name: /Back to/ })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "New File" })).toBeInTheDocument();
  });
});
