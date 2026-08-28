import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { CommandPalette } from "./index";

function renderPalette(onOpenChange?: (open: boolean) => void) {
  return render(
    <CommandPalette open onOpenChange={onOpenChange}>
      <CommandPalette.Content label="Mobile palette">
        <CommandPalette.Input />
        <CommandPalette.List>
          <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
        </CommandPalette.List>
      </CommandPalette.Content>
    </CommandPalette>,
  );
}

describe("CommandPalette narrow-viewport geometry", () => {
  // Public styling contract exception: jsdom cannot compute viewport-relative
  // layout, media queries, or env() insets, so the class contract is the only
  // observable form these geometry decisions take in a unit test.
  it("insets the panel from the viewport edge below 640px", () => {
    renderPalette();
    const content = screen.getByRole("dialog", { name: "Mobile palette" });

    expect(content).toHaveClass("max-sm:mx-3");
    expect(content).toHaveClass("max-sm:w-[calc(100%-1.5rem)]");
    expect(content).toHaveClass("max-sm:max-w-none");
  });

  it("pins the panel to the top so the software keyboard cannot displace it", () => {
    renderPalette();
    const content = screen.getByRole("dialog", { name: "Mobile palette" });

    expect(content).toHaveClass("mt-[max(0.75rem,env(safe-area-inset-top))]");
    expect(content).toHaveClass("mb-auto");
    expect(content).not.toHaveClass("m-auto");
  });

  it("keeps the OV-03 dynamic-viewport height cap", () => {
    renderPalette();
    const content = screen.getByRole("dialog", { name: "Mobile palette" });

    expect(content).toHaveClass("max-h-[80dvh]");
  });
});

describe("CommandPalette Esc close control", () => {
  it("is a real button with an accessible name", () => {
    renderPalette();

    const close = screen.getByRole("button", { name: "Close" });
    expect(close).toHaveAttribute("type", "button");
    expect(close).toHaveTextContent("Esc");
  });

  it("closes the palette on activation", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderPalette(onOpenChange);

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("is keyboard activatable", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderPalette(onOpenChange);

    screen.getByRole("button", { name: "Close" }).focus();
    await user.keyboard("{Enter}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("has no axe violations", async () => {
    const { container } = renderPalette();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("CommandPaletteContent mobile viewport contract", () => {
  function ModalPalette({ open, modal = true }: { open: boolean; modal?: boolean }) {
    return (
      <CommandPalette open={open}>
        <CommandPalette.Content modal={modal} label="Mobile palette">
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>
    );
  }

  // Public styling contract exception: the dvh unit IS the fix and jsdom cannot
  // compute viewport-relative layout.
  it("caps the surface against the dynamic viewport height", () => {
    render(<ModalPalette open />);
    const content = screen.getByRole("dialog", { name: "Mobile palette" });
    expect(content).toHaveClass("max-h-[80dvh]");
    expect(content).not.toHaveClass("max-h-[80vh]");
  });

  it("locks background scrolling while the modal palette is open and releases it on close", () => {
    document.body.style.overflow = "auto";
    const { rerender } = render(<ModalPalette open />);

    expect(document.body).toHaveAttribute("data-scroll-locked");
    expect(document.body.style.overflow).toBe("hidden");

    rerender(<ModalPalette open={false} />);

    expect(document.body).not.toHaveAttribute("data-scroll-locked");
    expect(document.body.style.overflow).toBe("auto");
  });

  it("never locks background scrolling for an inline palette", () => {
    document.body.style.overflow = "auto";
    render(<ModalPalette open modal={false} />);

    expect(document.body).not.toHaveAttribute("data-scroll-locked");
    expect(document.body.style.overflow).toBe("auto");
  });

  // Public styling contract exception: overscroll containment is not observable
  // in jsdom.
  it("contains overscroll inside the results scroller", () => {
    render(<ModalPalette open />);
    expect(screen.getByRole("listbox")).toHaveClass("overscroll-contain");
  });

  it("leaves the search input font-size to CSS so touch densities can floor it at 16px", () => {
    render(<ModalPalette open />);
    expect(screen.getByRole("combobox").style.fontSize).toBe("");
  });
});
