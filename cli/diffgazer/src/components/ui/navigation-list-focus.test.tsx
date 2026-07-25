import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import stripAnsi from "strip-ansi";
import { afterAll, afterEach, describe, expect, test, vi } from "vitest";
import { flush } from "../../testing/flush";
import { frameBackgrounds, frameForegrounds } from "../../testing/frame-colors";
import { selectionFill } from "../../theme/chrome";
import { darkPalette } from "../../theme/palettes";
import { CliThemeProvider } from "../../theme/provider";
import { NavigationList } from "./navigation-list";

// Ink reads colour support from the environment when it first imports chalk,
// which happens above this file's own imports. The rest of the NavigationList
// suite asserts plain text, so the colour cases live here instead.
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

function renderList(isActive: boolean) {
  return render(
    <CliThemeProvider initialTheme="dark">
      <NavigationList isActive={isActive} highlightedId="a">
        <NavigationList.Item id="a">
          <Text>Alpha</Text>
        </NavigationList.Item>
        <NavigationList.Item id="b">
          <Text>Bravo</Text>
        </NavigationList.Item>
      </NavigationList>
    </CliThemeProvider>,
  );
}

describe("NavigationList focus", () => {
  test("paints the highlighted row of a focused list with the selection fill", async () => {
    const { lastFrame } = renderList(true);
    await flush();

    expect(frameBackgrounds(lastFrame() ?? "")).toEqual([selectionFill(darkPalette)]);
  });

  test("drops the fill to a quiet marker once the list loses focus", async () => {
    const { lastFrame } = renderList(false);
    await flush();

    // Two lists side by side must not both claim the highlight, so the one
    // without focus names its row instead of painting it.
    expect(frameBackgrounds(lastFrame() ?? "")).toEqual([]);
    expect(frameForegrounds(lastFrame() ?? "")).toContain(selectionFill(darkPalette));
    expect(stripAnsi(lastFrame() ?? "")).toContain("> Alpha");
  });
});
