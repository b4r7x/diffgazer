import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { Button } from "../button/button";
import { DialogFooter } from "./dialog-footer";
import { Dialog } from "./index";

describe("DialogFooter responsive action structure", () => {
  it("groups shorthand actions in the reflow-capable actions row", () => {
    render(
      <DialogFooter hints={[{ key: "Esc", label: "Cancel" }]}>
        <Button>Discard localized changes</Button>
        <Button>Save localized changes</Button>
      </DialogFooter>,
    );

    const footer = screen.getByText("Cancel").closest('[data-slot="dialog-footer"]');
    if (!footer) throw new Error("Expected dialog footer");
    const actions = footer.querySelector('[data-slot="dialog-footer-actions"]');
    if (!(actions instanceof HTMLElement)) throw new Error("Expected dialog footer actions");

    expect(
      within(actions)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Discard localized changes", "Save localized changes"]);
    expect(screen.getByText("Esc")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Discard localized changes" })).toBeInTheDocument();
  });

  it("preserves explicit action-row props and accessible action order", async () => {
    const { container } = render(
      <DialogFooter>
        <DialogFooter.Actions aria-label="Form actions" className="consumer-actions">
          <Button>Cancel</Button>
          <Button>Save</Button>
        </DialogFooter.Actions>
      </DialogFooter>,
    );

    const actions = screen.getByLabelText("Form actions");
    expect(actions).toHaveAttribute("data-slot", "dialog-footer-actions");
    expect(actions).toHaveClass("consumer-actions");
    expect(
      within(actions)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Cancel", "Save"]);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("DialogFooter with keyboard hints", () => {
  const hints = [
    { key: "Esc", label: "Cancel" },
    { key: "↑/↓", label: "Navigate" },
    { key: "Enter", label: "Confirm" },
  ];

  function renderWithHints() {
    return render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Footer with hints</Dialog.Title>
          <Dialog.Footer hints={hints}>
            <Dialog.Close>Cancel</Dialog.Close>
            <Dialog.Action>Confirm</Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>,
    );
  }

  it("renders hints inside the footer subtree", () => {
    renderWithHints();
    const dialog = screen.getByRole("dialog", { name: "Footer with hints" });
    const navigateHint = within(dialog).getByText("Navigate");
    const footer = navigateHint.closest('[data-slot="dialog-footer"]');
    expect(footer).not.toBeNull();
  });

  it("renders all hint glyphs as Kbd elements", () => {
    renderWithHints();
    const dialog = screen.getByRole("dialog", { name: "Footer with hints" });
    for (const hint of hints) {
      const kbd = within(dialog).getByText(hint.key);
      expect(kbd.tagName).toBe("KBD");
    }
  });

  it("exposes the hint key names to assistive technology (not aria-hidden)", () => {
    renderWithHints();
    const dialog = screen.getByRole("dialog", { name: "Footer with hints" });
    for (const hint of hints) {
      const kbd = within(dialog).getByText(hint.key);
      expect(kbd).not.toHaveAttribute("aria-hidden");
      expect(kbd.closest("[aria-hidden='true']")).toBeNull();
    }
  });

  it("orders hints before actions inside the footer", () => {
    renderWithHints();
    const dialog = screen.getByRole("dialog", { name: "Footer with hints" });
    const navigateHint = within(dialog).getByText("Navigate");
    const footer = navigateHint.closest('[data-slot="dialog-footer"]');
    if (!footer) throw new Error("Expected dialog footer to be present");
    const confirmAction = within(dialog).getByRole("button", { name: "Confirm" });
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
    expect(navigateHint.compareDocumentPosition(confirmAction) & FOLLOWING).toBe(FOLLOWING);
  });

  it("keeps Tab order across action buttons; hint glyphs are not focusable", async () => {
    const user = userEvent.setup();
    renderWithHints();
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Confirm" });

    cancel.focus();
    expect(cancel).toHaveFocus();
    await user.tab();
    expect(confirm).toHaveFocus();

    for (const hint of hints) {
      const kbd = screen.getByText(hint.key);
      // Hint glyphs stay out of the tab order; AT exposure is covered by the
      // dedicated "exposes the hint key names" test above.
      expect(kbd.tabIndex).toBe(-1);
    }
  });

  it("renders no hint glyphs when no hints are provided", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>No hints</Dialog.Title>
          <Dialog.Footer>
            <Dialog.Action>OK</Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "No hints" });
    const action = within(dialog).getByRole("button", { name: "OK" });
    const footer = action.closest('[data-slot="dialog-footer"]');
    if (!footer) throw new Error("Expected dialog footer to be present");
    expect(footer.querySelector("kbd")).toBeNull();
  });

  it("has no a11y violations when rendering hints", async () => {
    const { container } = renderWithHints();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("DialogFooter surface", () => {
  it("paints no background of its own so it inherits the dialog fill", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Footer surface</Dialog.Title>
          <Dialog.Footer>
            <Dialog.Action>OK</Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Footer surface" });
    const footer = within(dialog)
      .getByRole("button", { name: "OK" })
      .closest('[data-slot="dialog-footer"]');
    if (!footer) throw new Error("Expected dialog footer to be present");
    // Class assertion retained: the footer's fill IS the public contract here
    // (a second-tone strip under the body is the regression), and jsdom cannot
    // compute the inherited background from the shipped stylesheet.
    expect(footer).not.toHaveClass("bg-background");
  });
});
