import { SEVERITY_LABELS } from "@diffgazer/core/schemas/presentation";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { SeverityBar } from "./bar";

afterEach(() => {
  cleanup();
});

describe("SeverityBar (TUI)", () => {
  test("renders the shared severity label instead of the raw enum value", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <SeverityBar severity="medium" count={3} filledCells={12} emptyCells={4} />
      </CliThemeProvider>,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain(SEVERITY_LABELS.medium);
    expect(frame).not.toContain("medium");
    expect(frame).toContain(`${"█".repeat(12)}${"░".repeat(4)}`);
  });
});
