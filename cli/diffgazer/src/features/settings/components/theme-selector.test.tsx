import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { ThemeSelector } from "./theme-selector";

afterEach(() => {
  cleanup();
});

const ARROW_DOWN = "\u001b[B";
const SPACE = " ";

async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

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

  test("navigates from Auto to Dark, selects with Space, and reports a single down boundary", async () => {
    const onChange = vi.fn();
    const onHighlightChange = vi.fn();
    const onDownBoundary = vi.fn();
    const { stdin } = render(
      <CliThemeProvider initialTheme="dark">
        <ThemeSelector
          value="auto"
          onChange={onChange}
          onHighlightChange={onHighlightChange}
          onDownBoundary={onDownBoundary}
        />
      </CliThemeProvider>,
    );
    await flush();

    stdin.write(ARROW_DOWN);
    await flush();
    expect(onHighlightChange).toHaveBeenLastCalledWith("dark");

    stdin.write(SPACE);
    await flush();
    expect(onChange).toHaveBeenLastCalledWith("dark");

    stdin.write(ARROW_DOWN);
    await flush();
    stdin.write(ARROW_DOWN);
    await flush();
    expect(onDownBoundary).toHaveBeenCalledOnce();
  });

  test("does not forward highlight changes when the step is inactive", async () => {
    const onHighlightChange = vi.fn();
    const { stdin } = render(
      <CliThemeProvider initialTheme="dark">
        <ThemeSelector
          value="auto"
          onChange={() => {}}
          onHighlightChange={onHighlightChange}
          isActive={false}
        />
      </CliThemeProvider>,
    );
    await flush();

    stdin.write(ARROW_DOWN);
    await flush();
    expect(onHighlightChange).not.toHaveBeenCalled();
  });
});
