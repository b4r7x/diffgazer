import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoDialog } from "../../examples/playground/src/components/demo-dialog";
import { CommandPaletteDemo } from "../../examples/playground/src/demos/command-palette";
import { FocusTrapDemo } from "../../examples/playground/src/demos/focus-trap";
import { GlobalShortcutsDemo } from "../../examples/playground/src/demos/global-shortcuts";
import { ScopedDialogDemo } from "../../examples/playground/src/demos/scoped-dialog";
import { KeyboardWrapper } from "../testing/test-utils.js";

vi.mock("@diffgazer/keys", () => import("../index.js"));

afterEach(() => {
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
  document.body.removeAttribute("data-scroll-locked");
});

function expectBodyScrollLocked() {
  expect(document.body.style.overflow).toBe("hidden");
}

function expectBodyScrollRestored(expected = "") {
  expect(document.body.style.overflow).toBe(expected);
}

function DialogHarness() {
  const [open, setOpen] = useState(false);
  const firstActionRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <nav aria-label="Playground demos">
        <button type="button" onClick={() => setOpen(true)}>
          Outside sidebar control
        </button>
      </nav>
      {open && (
        <DemoDialog
          title="Playground modal"
          initialFocus={firstActionRef}
          onClose={() => setOpen(false)}
        >
          <button ref={firstActionRef} type="button">
            First action
          </button>
          <button type="button" onClick={() => setOpen(false)}>
            Last action
          </button>
        </DemoDialog>
      )}
    </>
  );
}

describe("DemoDialog", () => {
  it("names the modal, wraps Tab in both directions, and restores outside focus", async () => {
    const user = userEvent.setup();
    document.body.style.overflow = "auto";
    render(<DialogHarness />);
    const outsideControl = screen.getByRole("button", { name: "Outside sidebar control" });

    await user.click(outsideControl);

    expect(
      screen.getByRole("dialog", { name: "Playground modal" }).getAttribute("aria-modal"),
    ).toBe("true");
    const firstAction = screen.getByRole("button", { name: "First action" });
    const lastAction = screen.getByRole("button", { name: "Last action" });
    expect(document.activeElement).toBe(firstAction);
    expectBodyScrollLocked();

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(lastAction);
    await user.tab();
    expect(document.activeElement).toBe(firstAction);

    await user.click(lastAction);
    expect(screen.queryByRole("dialog", { name: "Playground modal" })).toBeNull();
    expect(document.activeElement).toBe(outsideControl);
    expectBodyScrollRestored("auto");
  });

  it("provides the command palette with modal naming, initial focus, and focus restoration", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before command palette</button>
        <CommandPaletteDemo />
      </>,
      { wrapper: KeyboardWrapper },
    );
    const opener = screen.getByRole("button", { name: "Before command palette" });
    await user.click(opener);

    await user.keyboard("{Control>}k{/Control}");

    expect(screen.getByRole("dialog", { name: "Command Palette" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByPlaceholderText("Type a command..."));
    expectBodyScrollLocked();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Command Palette" })).toBeNull();
    expect(document.activeElement).toBe(opener);
    expectBodyScrollRestored();
  });

  it("provides the focus-trap demo with modal naming, initial focus, and focus restoration", async () => {
    const user = userEvent.setup();
    render(<FocusTrapDemo />, { wrapper: KeyboardWrapper });
    const opener = screen.getByRole("button", { name: "Open Modal" });

    await user.click(opener);

    expect(screen.getByRole("dialog", { name: "Modal Form" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Name" }));
    expectBodyScrollLocked();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Modal Form" })).toBeNull();
    expect(document.activeElement).toBe(opener);
    expectBodyScrollRestored();
  });

  it("provides the scoped dialog with modal naming, initial focus, and focus restoration", async () => {
    const user = userEvent.setup();
    render(<ScopedDialogDemo />, { wrapper: KeyboardWrapper });
    const opener = screen.getByRole("button", { name: "Open Dialog" });

    await user.click(opener);

    expect(screen.getByRole("dialog", { name: "Confirm Action" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    expectBodyScrollLocked();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Confirm Action" })).toBeNull();
    expect(document.activeElement).toBe(opener);
    expectBodyScrollRestored();
  });

  it("toggles and closes Global Shortcuts while its search input owns focus", async () => {
    const user = userEvent.setup();
    render(<GlobalShortcutsDemo />, { wrapper: KeyboardWrapper });

    await user.keyboard("{Control>}k{/Control}");
    const search = screen.getByPlaceholderText("Search...");
    expect(document.activeElement).toBe(search);

    await user.keyboard("/");
    expect(search).toHaveProperty("value", "/");
    expect(screen.getByText("Last action: Toggled search bar")).toBeTruthy();

    await user.keyboard("{Control>}k{/Control}");
    expect(screen.queryByPlaceholderText("Search...")).toBeNull();

    await user.keyboard("{Control>}k{/Control}");
    expect(document.activeElement).toBe(screen.getByPlaceholderText("Search..."));
    await user.keyboard("{Escape}");

    expect(screen.queryByPlaceholderText("Search...")).toBeNull();
  });
});
