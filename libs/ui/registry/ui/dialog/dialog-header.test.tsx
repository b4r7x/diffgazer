import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dialog } from "./index";

describe("DialogTitle data-slot", () => {
  it('exposes data-slot="dialog-title" on the heading element', () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Slotted title</Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    );
    const heading = screen.getByRole("heading", { name: "Slotted title" });
    expect(heading).toHaveAttribute("data-slot", "dialog-title");
  });
});

describe("DialogHeader strip and DialogTitle meta", () => {
  it("bands the title and the close control across the top of the dialog", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Strip title</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>Body content</Dialog.Body>
        </Dialog.Content>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Strip title" });
    const heading = within(dialog).getByRole("heading", { name: "Strip title" });
    expect(heading.closest('[data-slot="dialog-header"]')).not.toBeNull();
    expect(within(dialog).getByRole("button", { name: "Close dialog" })).toBeInTheDocument();
  });

  it("renders header children as direct descendants of the strip", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Flat header</Dialog.Title>
          </Dialog.Header>
        </Dialog.Content>
      </Dialog>,
    );
    const header = screen
      .getByRole("dialog", { name: "Flat header" })
      .querySelector('[data-slot="dialog-header"]') as HTMLElement | null;
    if (!header) throw new Error("Expected dialog header");
    expect(header.firstElementChild).toHaveAttribute("data-slot", "dialog-title");
  });

  it("renders Title and Description inside the header subtree", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Column title</Dialog.Title>
            <Dialog.Description>Column description</Dialog.Description>
          </Dialog.Header>
        </Dialog.Content>
      </Dialog>,
    );
    const heading = screen.getByRole("heading", { name: "Column title" });
    const header = heading.closest('[data-slot="dialog-header"]');
    if (!header) throw new Error("Expected dialog header");
    expect(within(header as HTMLElement).getByRole("heading", { name: "Column title" })).toBe(
      heading,
    );
    expect(within(header as HTMLElement).getByText("Column description")).toBeInTheDocument();
  });

  it("keeps the meta tag out of the accessible name while exposing it to AT", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title meta="CONFIRM">Apply patch</Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    );
    // The accessible name resolves to the title text alone, not "Apply patch CONFIRM".
    const dialog = screen.getByRole("dialog", { name: "Apply patch" });
    const meta = within(dialog).getByText("CONFIRM");
    // Meta is visible to AT (page content): not aria-hidden, and not nested in
    // an aria-hidden ancestor.
    expect(meta).not.toHaveAttribute("aria-hidden");
    expect(meta.closest("[aria-hidden='true']")).toBeNull();
  });

  it("omits the meta tag when not provided", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>No meta</Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "No meta" });
    expect(within(dialog).queryByText("CONFIRM")).toBeNull();
  });

  it("preserves automatic accessible-name resolution through the strip", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Auto labelled</Dialog.Title>
          </Dialog.Header>
        </Dialog.Content>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Auto labelled" });
    expect(dialog).toHaveAttribute("aria-labelledby");
    expect(dialog).not.toHaveAttribute("aria-label");
  });
});

describe("Dialog.Title meta eyebrow", () => {
  it('exposes data-slot="dialog-title-meta" so the close icon can claim the corner', () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title meta="CONFIRM">Apply Patch</Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "Apply Patch" });
    const eyebrow = dialog.querySelector('[data-slot="dialog-title-meta"]');
    expect(eyebrow).toHaveTextContent("CONFIRM");
    // The eyebrow is a sibling of the heading, not part of it, so it stays out
    // of the dialog's accessible name.
    expect(dialog.querySelector('[data-slot="dialog-title"]')).toHaveTextContent("Apply Patch");
  });
});
