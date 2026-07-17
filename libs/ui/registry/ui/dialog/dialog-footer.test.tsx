import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { Button } from "../button/button";
import { DialogFooter } from "./dialog-footer";

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

    expect(within(actions).getAllByRole("button")).toHaveLength(2);
    expect(footer).toHaveTextContent("EscCancelDiscard localized changesSave localized changes");
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
