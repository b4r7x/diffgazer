import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, it } from "vitest";
import { CliThemeProvider, useTheme } from "./provider";

afterEach(() => {
  cleanup();
});

function ThemeProbe() {
  const { themeName } = useTheme();
  return <Text>theme:{themeName}</Text>;
}

describe("CliThemeProvider render", () => {
  it("resolves the advertised high-contrast CLI theme to its named palette", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="high-contrast">
        <ThemeProbe />
      </CliThemeProvider>,
    );

    expect(lastFrame()).toContain("theme:high-contrast");
  });
});
