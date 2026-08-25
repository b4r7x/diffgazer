import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../theme/provider";
import { ErrorGatePanel } from "./error-gate";

vi.mock("../../hooks/use-terminal-dimensions", () => ({
  useTerminalDimensions: () => ({ columns: 80, rows: 24 }),
}));

afterEach(() => {
  cleanup();
});

describe("ErrorGatePanel", () => {
  test("draws the variant glyph before the title and the stitch under the meta line", () => {
    const view = render(
      <CliThemeProvider initialTheme="dark">
        <ErrorGatePanel
          title="Configuration Unavailable"
          message="Diffgazer could not read the saved configuration."
          meta="openai / gpt-5"
        />
      </CliThemeProvider>,
    );

    const frame = view.lastFrame() ?? "";
    expect(frame).toContain("✖ Configuration Unavailable");
    expect(frame).toContain("openai / gpt-5");
    expect(frame).toContain("── ──");
  });

  test("omits the stitch when the gate has no meta line", () => {
    const view = render(
      <CliThemeProvider initialTheme="dark">
        <ErrorGatePanel
          title="Server Unreachable"
          message="The embedded server did not answer."
          variant="warning"
        />
      </CliThemeProvider>,
    );

    const frame = view.lastFrame() ?? "";
    expect(frame).toContain("⚠ Server Unreachable");
    expect(frame).not.toContain("── ──");
  });
});
