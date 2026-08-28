import { cleanup, render } from "ink-testing-library";
import { afterAll, afterEach, describe, expect, test, vi } from "vitest";
import { frameBackgrounds, frameForegrounds } from "../../testing/frame-colors";
import { selectionHue } from "../../theme/chrome";
import { darkPalette } from "../../theme/palettes";
import { CliThemeProvider } from "../../theme/provider";
import type { ButtonProps } from "./button";
import { Button } from "./button";

// Ink reads colour support from the environment when it first imports chalk,
// which happens above this file's own imports.
const restoreForceColor = vi.hoisted(() => {
  const previous = process.env.FORCE_COLOR;
  process.env.FORCE_COLOR = "3";
  return () => {
    if (previous === undefined) delete process.env.FORCE_COLOR;
    else process.env.FORCE_COLOR = previous;
  };
});

afterAll(restoreForceColor);

afterEach(() => {
  cleanup();
});

const VARIANTS: NonNullable<ButtonProps["variant"]>[] = [
  "primary",
  "secondary",
  "destructive",
  "success",
  "ghost",
];

function renderButton(props: Partial<ButtonProps> = {}) {
  return render(
    <CliThemeProvider initialTheme="dark">
      <Button {...props}>Refresh Diagnostics</Button>
    </CliThemeProvider>,
  );
}

describe("Button focus", () => {
  test.each(VARIANTS)("fills a focused %s button with the selection hue", (variant) => {
    const { lastFrame } = renderButton({ variant, isActive: true });

    expect(frameBackgrounds(lastFrame() ?? "")).toEqual([selectionHue(darkPalette)]);
    expect(frameForegrounds(lastFrame() ?? "")).toContain(darkPalette.bg);
  });

  test("still tells the variants apart while they rest", () => {
    const secondary = renderButton({ variant: "secondary" });
    const primary = renderButton({ variant: "primary" });

    expect(frameBackgrounds(secondary.lastFrame() ?? "")).toEqual([]);
    expect(frameForegrounds(secondary.lastFrame() ?? "")).not.toEqual(
      frameForegrounds(primary.lastFrame() ?? ""),
    );
  });

  test("does not fill a disabled or loading button that holds the action row", () => {
    for (const props of [{ disabled: true }, { loading: true }]) {
      const { lastFrame } = renderButton({ variant: "primary", isActive: true, ...props });
      expect(frameBackgrounds(lastFrame() ?? "")).toEqual([]);
      cleanup();
    }
  });
});
