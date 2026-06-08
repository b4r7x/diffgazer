// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  orderThemeDocsPrimitives,
  THEME_DOCS_COLOR_GRID_ORDER,
  THEME_DOCS_PLAYGROUND_ORDER,
  THEME_DOCS_PRIMITIVES,
  THEME_DOCS_TOKENS,
} from "@diffgazer/ui/theme";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ColorGrid } from "./components/color-grid";
import { ThemePlayground } from "./components/playground";

describe("orderThemeDocsPrimitives", () => {
  it("returns primitives in the requested display order", () => {
    const ordered = orderThemeDocsPrimitives(THEME_DOCS_COLOR_GRID_ORDER);
    expect(ordered.map((primitive) => primitive.name)).toEqual(THEME_DOCS_COLOR_GRID_ORDER);
  });

  it("sources values from the shared UI theme primitives, not the order list", () => {
    const ordered = orderThemeDocsPrimitives(THEME_DOCS_COLOR_GRID_ORDER);
    for (const primitive of ordered) {
      const canonical = THEME_DOCS_PRIMITIVES.find(
        (candidate) => candidate.name === primitive.name,
      );
      expect(primitive.darkValue).toBe(canonical?.darkValue);
    }
  });

  it("throws when the order list omits or invents a primitive", () => {
    expect(() => orderThemeDocsPrimitives(["--tui-bg"])).toThrow();
    expect(() => orderThemeDocsPrimitives(THEME_DOCS_PRIMITIVES.map(() => "--tui-bogus"))).toThrow(
      /Unknown TUI primitive/,
    );
  });
});

describe("display orders", () => {
  const swatchOrder = [
    "--tui-bg",
    "--tui-fg",
    "--tui-dim",
    "--tui-blue",
    "--tui-green",
    "--tui-red",
    "--tui-yellow",
    "--tui-violet",
    "--tui-border",
    "--tui-highlight",
    "--tui-highlight-fg",
    "--tui-selection",
    "--tui-muted",
    "--tui-input-bg",
  ];

  const editableOrder = [
    "--tui-bg",
    "--tui-fg",
    "--tui-dim",
    "--tui-blue",
    "--tui-violet",
    "--tui-green",
    "--tui-red",
    "--tui-yellow",
    "--tui-border",
    "--tui-highlight",
    "--tui-highlight-fg",
    "--tui-selection",
    "--tui-muted",
    "--tui-input-bg",
  ];

  it("keeps the color-grid swatch order", () => {
    expect(THEME_DOCS_COLOR_GRID_ORDER).toEqual(swatchOrder);
  });

  it("keeps the playground editable-row order", () => {
    expect(THEME_DOCS_PLAYGROUND_ORDER).toEqual(editableOrder);
  });

  it("covers every primitive exactly once", () => {
    const names = THEME_DOCS_PRIMITIVES.map((primitive) => primitive.name).sort();
    expect([...THEME_DOCS_COLOR_GRID_ORDER].sort()).toEqual(names);
    expect([...THEME_DOCS_PLAYGROUND_ORDER].sort()).toEqual(names);
  });
});

describe("docs theme visualizer", () => {
  it("renders every documented theme token in the color grid", () => {
    render(<ColorGrid />);

    expect(screen.getAllByRole("button", { name: /Copy --/i })).toHaveLength(
      THEME_DOCS_TOKENS.length,
    );

    for (const token of THEME_DOCS_TOKENS) {
      expect(screen.getByText(token.name)).toBeInTheDocument();
    }
  });

  it("renders a playground control for every editable primitive", () => {
    render(<ThemePlayground />);

    for (const primitive of orderThemeDocsPrimitives(THEME_DOCS_PLAYGROUND_ORDER)) {
      expect(screen.getByLabelText(`Color picker for ${primitive.name}`)).toBeInTheDocument();
    }
  });
});
