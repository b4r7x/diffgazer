import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { OverlayHints } from "./overlay-hints";

function getBar(): HTMLElement {
  const node = document.querySelector('[data-slot="overlay-hints"]');
  if (node === null) throw new Error("hint bar not rendered");
  return node as HTMLElement;
}

describe("OverlayHints", () => {
  it("renders each key group with its label", () => {
    render(
      <OverlayHints>
        <OverlayHints.Item keys={["↑", "↓"]}>Navigate</OverlayHints.Item>
        <OverlayHints.Item keys={["↵"]}>Select</OverlayHints.Item>
      </OverlayHints>,
    );

    const items = document.querySelectorAll('[data-slot="overlay-hints-item"]');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("↑↓Navigate");
    expect(items[1]).toHaveTextContent("↵Select");
  });

  it("hides the legend from assistive technology by default", () => {
    render(
      <OverlayHints>
        <OverlayHints.Item keys={["Esc"]}>Close</OverlayHints.Item>
      </OverlayHints>,
    );

    expect(getBar()).toHaveAttribute("aria-hidden", "true");
    // Nothing inside the bar reaches the accessibility tree: the shortcuts are
    // already announced by the real controls they belong to.
    expect(
      screen.queryByText("Close", { ignore: '[aria-hidden="true"], [aria-hidden="true"] *' }),
    ).not.toBeInTheDocument();
  });

  it("exposes the keys when a consumer opts in", () => {
    render(
      <OverlayHints aria-hidden={false}>
        <OverlayHints.Item keys={["Esc"]}>Close</OverlayHints.Item>
      </OverlayHints>,
    );

    expect(getBar()).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByText("Close")).toBeInTheDocument();
    expect(screen.getByText("Esc")).toBeInTheDocument();
  });

  it("marks touch-relevant items so the coarse-pointer rule can keep them", () => {
    render(
      <OverlayHints>
        <OverlayHints.Item keys={["↵"]}>Select</OverlayHints.Item>
        <OverlayHints.Item keys={["Esc"]} touch>
          Close
        </OverlayHints.Item>
      </OverlayHints>,
    );

    const items = document.querySelectorAll('[data-slot="overlay-hints-item"]');
    expect(items[0]).not.toHaveAttribute("data-touch");
    expect(items[1]).toHaveAttribute("data-touch");
  });

  it("fills a childless CommandPalette footer with the canonical legend", async () => {
    const { CommandPalette } = await import("../command-palette");
    render(
      <CommandPalette open>
        <CommandPalette.Content>
          <CommandPalette.List>
            <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
          </CommandPalette.List>
          <CommandPalette.Footer />
        </CommandPalette.Content>
      </CommandPalette>,
    );

    const footer = document.querySelector('[data-slot="command-palette-footer"]');
    expect(footer?.querySelector('[data-slot="overlay-hints"]')).not.toBeNull();
    // The bar is the footer's ONLY child, which is what lets the coarse-pointer
    // :only-child rule collapse the whole strip instead of leaving dead chrome.
    expect(footer?.children).toHaveLength(1);
    expect(footer?.querySelectorAll('[data-slot="overlay-hints-item"]')).toHaveLength(3);
    expect(footer).toHaveTextContent("Navigate");
    expect(footer).toHaveTextContent("Select");
    expect(footer).toHaveTextContent("Close");
  });

  it("keeps Dialog's hints exposed to assistive technology", async () => {
    const { DialogFooter } = await import("../dialog/dialog-footer");
    render(<DialogFooter hints={[{ key: "Esc", label: "Cancel" }]} />);

    expect(getBar()).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByText("Esc")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <OverlayHints aria-hidden={false}>
        <OverlayHints.Item keys={["↑", "↓"]}>Navigate</OverlayHints.Item>
      </OverlayHints>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
