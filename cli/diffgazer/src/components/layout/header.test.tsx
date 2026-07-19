import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../theme/provider";
import { Header } from "./header";

vi.mock("../../hooks/use-terminal-dimensions", () => ({
  useResponsive: () => ({
    columns: 80,
    rows: 24,
    tier: "medium",
    isNarrow: false,
    isMedium: true,
    isWide: false,
  }),
}));

afterEach(() => {
  cleanup();
});

describe("Header", () => {
  test("keeps a long model identifier inside the fixed header rows at 80 columns", () => {
    const providerName = `OpenRouter · ${"model-segment-".repeat(4)}`;
    const view = render(
      <CliThemeProvider initialTheme="dark">
        <Header providerName={providerName} providerStatus="active" showBack />
      </CliThemeProvider>,
    );

    const frame = view.lastFrame() ?? "";
    expect(frame.split("\n")).toHaveLength(3);
    expect(frame).toContain("diffgazer");
    expect(frame).toContain("· active");
  });
});
