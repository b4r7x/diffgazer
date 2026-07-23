// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  THEME_DOCS_COLOR_GRID_ORDER,
  THEME_DOCS_PLAYGROUND_ORDER,
  THEME_DOCS_TOKENS,
} from "@diffgazer/ui/theme";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemeProvider } from "@/hooks/theme-context";
import { ColorGrid } from "./components/color-grid";
import { ThemePlayground } from "./components/playground";

function primitiveNamesFromCopyButtons(container: HTMLElement): string[] {
  return within(container)
    .getAllByRole("button")
    .map((button) => {
      const match = (button.getAttribute("aria-label") ?? "").match(/Copy (--[a-z0-9-]+)/);
      return match?.[1];
    })
    .filter((name): name is string => name !== undefined);
}

describe("T-057 docs theme visualizer", () => {
  it("renders every documented theme token in the color grid", () => {
    render(
      <ThemeProvider>
        <ColorGrid />
      </ThemeProvider>,
    );

    expect(screen.getAllByRole("button", { name: /Copy --/i })).toHaveLength(
      THEME_DOCS_TOKENS.length,
    );

    for (const token of THEME_DOCS_TOKENS) {
      expect(screen.getByText(token.name)).toBeInTheDocument();
    }

    const primitivesSection = screen.getByRole("heading", { name: "Primitives" }).parentElement;
    if (primitivesSection === null) throw new Error("Primitives heading has no parent section");
    expect(primitiveNamesFromCopyButtons(primitivesSection)).toEqual([
      ...THEME_DOCS_COLOR_GRID_ORDER,
    ]);
  });

  it("renders a playground control for every editable primitive", () => {
    render(
      <ThemeProvider>
        <ThemePlayground />
      </ThemeProvider>,
    );

    for (const name of THEME_DOCS_PLAYGROUND_ORDER) {
      expect(screen.getByLabelText(`Color picker for ${name}`)).toBeInTheDocument();
    }

    const pickerOrder = screen
      .getAllByLabelText(/^Color picker for --base-/)
      .map((picker) => (picker.getAttribute("aria-label") ?? "").replace("Color picker for ", ""));

    expect(pickerOrder).toEqual([...THEME_DOCS_PLAYGROUND_ORDER]);
  });
});
