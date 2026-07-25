import { THEME_DOCS_PRIMITIVES } from "@diffgazer/ui/theme";
import { describe, expect, it } from "vitest";
import {
  orderThemeDocsPrimitives,
  THEME_DOCS_COLOR_GRID_ORDER,
  THEME_DOCS_PLAYGROUND_ORDER,
} from "./token-presentation";

describe("T-057 orderThemeDocsPrimitives", () => {
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

  it("throws when the order list omits a primitive", () => {
    expect(() => orderThemeDocsPrimitives([THEME_DOCS_PRIMITIVES[0].name])).toThrow();
  });

  it("rejects an order array with a name that is not a primitive", () => {
    expect(() =>
      orderThemeDocsPrimitives([
        // @ts-expect-error -- a typo'd primitive name is now a compile error, not a runtime throw.
        "--base-typo",
        ...THEME_DOCS_COLOR_GRID_ORDER.slice(1),
      ]),
    ).toThrow(/missing primitives/);
  });
});

describe("T-057 display orders", () => {
  const swatchOrder = [
    "--base-bg",
    "--base-fg",
    "--base-dim",
    "--base-info",
    "--base-success",
    "--base-danger",
    "--base-warning",
    "--base-accent",
    "--base-border",
    "--base-highlight",
    "--base-highlight-foreground",
    "--base-selection",
    "--base-muted",
    "--base-input-bg",
  ];

  const editableOrder = [
    "--base-bg",
    "--base-fg",
    "--base-dim",
    "--base-info",
    "--base-accent",
    "--base-success",
    "--base-danger",
    "--base-warning",
    "--base-border",
    "--base-highlight",
    "--base-highlight-foreground",
    "--base-selection",
    "--base-muted",
    "--base-input-bg",
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
