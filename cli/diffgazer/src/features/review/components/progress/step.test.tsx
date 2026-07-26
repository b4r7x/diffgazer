import { cleanup, render } from "ink-testing-library";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test } from "vitest";
import { CliThemeProvider } from "../../../../theme/provider";
import { ProgressStep } from "./step";

afterEach(() => {
  cleanup();
});

describe("ProgressStep", () => {
  test("keeps completed and pending labels aligned with single-cell markers", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ProgressStep name="Completed" status="completed" />
        <ProgressStep name="Pending" status="pending" />
      </CliThemeProvider>,
    );

    const lines = (lastFrame() ?? "").split("\n");
    expect(lines).toEqual(["* Completed", "\u00b7 Pending"]);
  });

  test("marks the active step and starts every label at the same column", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ProgressStep name="Completed" status="completed" />
        <ProgressStep name="Running" status="active" />
        <ProgressStep name="Pending" status="pending" />
      </CliThemeProvider>,
    );

    const lines = stripAnsi(lastFrame() ?? "").split("\n");
    const columns = ["Completed", "Running", "Pending"].map((label) => {
      const line = lines.find((row) => row.includes(label));
      if (line === undefined) throw new Error(`no row for ${label}`);
      return line.indexOf(label);
    });

    expect(new Set(columns).size).toBe(1);
    // The active row is never blank in the marker column.
    const runningRow = lines.find((row) => row.includes("Running")) ?? "";
    expect(runningRow.trimStart()).toBe(runningRow);
    expect(runningRow[0]).not.toBe(" ");
  });
});
