import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { Dialog } from "./index";

function CloseButtons() {
  return (
    <Dialog open>
      <Dialog.Close />
      <Dialog.Close>Close panel</Dialog.Close>
      <Dialog.Close>
        <svg aria-hidden="true" viewBox="0 0 10 10">
          <path d="m1 1 8 8m0-8-8 8" />
        </svg>
      </Dialog.Close>
      <Dialog.Close aria-label="Dismiss details">
        <svg aria-hidden="true" viewBox="0 0 10 10">
          <path d="m1 1 8 8m0-8-8 8" />
        </svg>
      </Dialog.Close>
    </Dialog>
  );
}

function HiddenContentCloseButton() {
  return (
    <Dialog open>
      <Dialog.Close data-testid="hidden-content-close">
        <span>
          <span hidden>Hidden label</span>
        </span>
      </Dialog.Close>
    </Dialog>
  );
}

describe("DialogClose", () => {
  it("names default, text, decorative-icon, and explicitly labelled controls", async () => {
    const { container } = render(<CloseButtons />);

    expect(screen.getAllByRole("button", { name: "Close dialog" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Close panel" })).not.toHaveAttribute("aria-label");
    expect(screen.getByRole("button", { name: "Dismiss details" })).toHaveAttribute(
      "aria-label",
      "Dismiss details",
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("retains the default name when child content cannot name the button", async () => {
    const { container } = render(<HiddenContentCloseButton />);

    const close = screen.getByTestId("hidden-content-close");
    expect(close).toHaveAccessibleName("Close dialog");
    expect(close).toHaveAttribute("aria-label", "Close dialog");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("uses an explicit aria-labelledby name before the child fallback", async () => {
    const { container } = render(
      <>
        <span id="dialog-close-label">Dismiss details</span>
        <Dialog open>
          <Dialog.Close aria-labelledby="dialog-close-label">
            <svg aria-hidden="true" viewBox="0 0 10 10" />
          </Dialog.Close>
        </Dialog>
      </>,
    );

    const close = screen.getByRole("button", { name: "Dismiss details" });
    expect(close).toHaveAttribute("aria-labelledby", "dialog-close-label");
    expect(close).not.toHaveAttribute("aria-label");
    expect(await axe(container)).toHaveNoViolations();
  });
});
