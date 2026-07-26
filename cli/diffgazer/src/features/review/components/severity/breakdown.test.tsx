import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test } from "vitest";
import { CliThemeProvider } from "../../../../theme/provider";
import { SeverityBreakdown } from "./breakdown";

afterEach(() => {
  cleanup();
});

function renderBreakdown(
  counts: Parameters<typeof SeverityBreakdown>[0]["counts"],
  contentWidth = 40,
): string {
  const { lastFrame } = render(
    <CliThemeProvider initialTheme="dark">
      <SeverityBreakdown counts={counts} contentWidth={contentWidth} />
    </CliThemeProvider>,
  );
  return lastFrame() ?? "";
}

describe("SeverityBreakdown (TUI)", () => {
  test("states every severity count as text beside a full-width ribbon", () => {
    const frame = renderBreakdown({ blocker: 1, high: 2, medium: 2, low: 2, nit: 1 });

    for (const chip of ["[BLOCKER 1]", "[HIGH 2]", "[MED 2]", "[LOW 2]", "[NIT 1]"]) {
      expect(frame).toContain(chip);
    }
    const ribbonRow = frame.split("\n").find((row) => row.includes("█"));
    expect(ribbonRow).toBeDefined();
    expect((ribbonRow ?? "").replaceAll(/[^█]/g, "")).toHaveLength(40);
  });

  test("draws no empty remainder track, so the ribbon means share of the run", () => {
    const frame = renderBreakdown({ blocker: 0, high: 1, medium: 0, low: 0, nit: 0 });

    expect(frame).not.toContain("░");
    expect(frame).toContain("[HIGH 1]");
    expect(frame).toContain("[BLOCKER 0]");
  });

  test("takes two rows on a full-width section, so it cannot push the preview off screen", () => {
    const frame = renderBreakdown({ blocker: 1, high: 2, medium: 2, low: 2, nit: 1 }, 56);

    expect(frame.split("\n").filter((row) => row.trim().length > 0)).toHaveLength(2);
  });
});
