import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { ToggleGroup } from "../ui/toggle-group";
import { FOCUS_OUTLINE, FOCUS_OUTLINE_INSET, HIGHLIGHT_OUTLINE } from "./focus-outline";

/**
 * The focus mark's public contract: one 2px --ring outline hugging the control
 * edge, spelled once. jsdom compiles no Tailwind, so these assert the
 * documented class contract the constants ARE, and that the primitives consume
 * the constant rather than re-spelling the grammar.
 */
describe("focus outline", () => {
  it("hugs the control edge with the ring token in every spelling", () => {
    for (const grammar of [FOCUS_OUTLINE, FOCUS_OUTLINE_INSET]) {
      expect(grammar).toContain("outline-2");
      expect(grammar).toContain("outline-ring");
    }
    expect(FOCUS_OUTLINE).toContain("focus-visible:outline-offset-0");
    expect(FOCUS_OUTLINE_INSET).toContain("focus-visible:outline-offset-[-2px]");
  });

  it("spells virtual highlight as real focus minus the focus-visible gate", () => {
    expect(HIGHLIGHT_OUTLINE).toBe(FOCUS_OUTLINE.replaceAll("focus-visible:", ""));
  });

  it("marks Button with the grammar for real focus and for collection highlight", () => {
    render(
      <>
        <Button>Save</Button>
        <Button highlighted>Next</Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Save" })).toHaveClass(...FOCUS_OUTLINE.split(" "));
    expect(screen.getByRole("button", { name: "Next" })).toHaveClass(
      ...HIGHLIGHT_OUTLINE.split(" "),
    );
  });

  it("marks segmented items with the grammar for real focus and for collection highlight", () => {
    render(
      <ToggleGroup label="View" value="grid" highlighted="list">
        <ToggleGroup.Item value="grid">Grid</ToggleGroup.Item>
        <ToggleGroup.Item value="list">List</ToggleGroup.Item>
      </ToggleGroup>,
    );

    expect(screen.getByRole("radio", { name: "Grid" })).toHaveClass(...FOCUS_OUTLINE.split(" "));
    expect(screen.getByRole("radio", { name: "List" })).toHaveClass(
      ...HIGHLIGHT_OUTLINE.split(" "),
    );
  });

  it("draws the mark inside a keyboard-scrollable region so the scroller cannot clip it", () => {
    render(<ScrollArea aria-label="Log">content</ScrollArea>);

    expect(screen.getByRole("region", { name: "Log" })).toHaveClass(
      ...FOCUS_OUTLINE_INSET.split(" "),
    );
  });
});
