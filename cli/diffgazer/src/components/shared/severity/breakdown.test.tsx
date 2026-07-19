import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { SeverityBreakdown } from "./breakdown";

afterEach(() => {
  cleanup();
});

describe("SeverityBreakdown (TUI)", () => {
  test("renders every severity with an empty track for zero counts", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <SeverityBreakdown counts={{ blocker: 0, high: 1, medium: 0, low: 0, nit: 0 }} />
      </CliThemeProvider>,
    );
    const frame = lastFrame() ?? "";

    expect(frame).toContain("BLOCKER");
    expect(frame).toContain("HIGH");
    expect(frame).toContain("MED");
    expect(frame).toContain("LOW");
    expect(frame).toContain("NIT");
    expect(frame).toContain("░".repeat(16));
  });
});
