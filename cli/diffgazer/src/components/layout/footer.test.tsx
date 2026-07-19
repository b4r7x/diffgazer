import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { getHistoryFooter } from "../../features/history/lib/footer";
import { CliThemeProvider } from "../../theme/provider";
import { Footer } from "./footer";

vi.mock("../../hooks/use-terminal-dimensions", () => ({
  useTerminalDimensions: () => ({ columns: 80, rows: 24 }),
}));

afterEach(() => {
  cleanup();
});

describe("Footer", () => {
  test("keeps the history runs legend to one row at 80 columns", () => {
    const footer = getHistoryFooter("runs");
    const view = render(
      <CliThemeProvider initialTheme="dark">
        <Footer shortcuts={footer.shortcuts} rightShortcuts={footer.rightShortcuts} />
      </CliThemeProvider>,
    );

    const frame = view.lastFrame() ?? "";
    expect(frame.split("\n")).toHaveLength(1);
    expect(frame).toContain("[Enter] Open Review");
    expect(frame).toContain("[Esc] Back");
    expect(frame).not.toContain("[o] Open Review");
  });
});
