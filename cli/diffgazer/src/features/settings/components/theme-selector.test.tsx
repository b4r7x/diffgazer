import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { ThemeSelector } from "./theme-selector";

afterEach(() => {
  cleanup();
});

describe("ThemeSelector", () => {
  test("renders the shared selectable theme labels", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ThemeSelector value="auto" onChange={() => {}} />
      </CliThemeProvider>,
    );
    const frame = lastFrame() ?? "";

    expect(frame).toContain("Auto");
    expect(frame).toContain("Dark");
    expect(frame).toContain("Light");
  });
});
