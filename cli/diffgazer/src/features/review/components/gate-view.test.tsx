import { FooterProvider } from "@diffgazer/core/footer";
import { Box } from "ink";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { flush } from "../../../testing/flush";
import { waitUntil } from "../../../testing/wait-until";
import { CliThemeProvider } from "../../../theme/provider";
import { frameText } from "../testing/frame-text";
import { ReviewGateView, type ReviewGateViewProps } from "./gate-view";

const ARROW_RIGHT = "\u001b[C";
const ESCAPE = "\u001b";
const CONTENT_ROWS = 18;

function frameLines(frame: string | undefined): string[] {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: strips terminal color codes for layout math
  return (frame ?? "").replace(/\u001b\[[0-9;]*m/g, "").split("\n");
}

function renderGate(overrides: Partial<ReviewGateViewProps> = {}) {
  const onPrimary = vi.fn();
  const onBack = vi.fn();
  const view = render(
    <CliThemeProvider initialTheme="dark">
      <FooterProvider initialShortcuts={[]}>
        <Box height={CONTENT_ROWS} flexDirection="column">
          <ReviewGateView
            title="Configuration Unavailable"
            body="Diffgazer could not load the current configuration."
            variant="error"
            primaryLabel="Retry"
            onPrimary={onPrimary}
            onBack={onBack}
            {...overrides}
          />
        </Box>
      </FooterProvider>
    </CliThemeProvider>,
  );
  return { ...view, onPrimary, onBack };
}

afterEach(() => {
  cleanup();
});

describe("ReviewGateView (TUI)", () => {
  test("frames the failure with the gate panel glyph and copy", () => {
    const { lastFrame } = renderGate();
    const frame = lastFrame() ?? "";

    expect(frame).toContain("✖ Configuration Unavailable");
    expect(frameText(frame)).toContain("Diffgazer could not load the current configuration.");
    expect(frame).toContain("[ Retry ]");
    expect(frame).toContain("[ Back ]");
  });

  test("warning gates use the warning glyph", () => {
    const { lastFrame } = renderGate({ variant: "warning", title: "No Staged Changes" });

    expect(lastFrame()).toContain("⚠ No Staged Changes");
  });

  test("centers the panel inside the available content area", () => {
    const { lastFrame } = renderGate();
    const lines = frameLines(lastFrame());
    const panelTop = lines.findIndex((line) => line.includes("┌"));
    const panelBottom = lines.findIndex((line) => line.includes("└"));

    expect(panelTop).toBeGreaterThan(0);
    const rowsAbove = panelTop;
    const rowsBelow = lines.length - 1 - panelBottom;
    expect(rowsAbove).toBeGreaterThanOrEqual(2);
    expect(rowsBelow).toBeGreaterThanOrEqual(2);
    expect(Math.abs(rowsAbove - rowsBelow)).toBeLessThanOrEqual(2);
    expect(lines[panelTop]?.indexOf("┌")).toBeGreaterThan(0);
  });

  test("Enter retries and Escape goes back", async () => {
    const { stdin, onPrimary, onBack } = renderGate();

    stdin.write("\r");
    await waitUntil(() => onPrimary.mock.calls.length === 1);

    stdin.write(ESCAPE);
    await waitUntil(() => onBack.mock.calls.length === 1);
  });

  test("Space activates the focused action", async () => {
    const { stdin, onPrimary, onBack } = renderGate();

    stdin.write(" ");
    await waitUntil(() => onPrimary.mock.calls.length === 1);
    expect(onBack).not.toHaveBeenCalled();
  });

  test("offers Configure Provider as a reachable recovery action", async () => {
    const onGoToSettings = vi.fn();
    const { stdin, lastFrame, onPrimary, onBack } = renderGate({ onGoToSettings });

    expect(lastFrame()).toContain("Configure Provider");

    stdin.write(ARROW_RIGHT);
    await flush();
    stdin.write("\r");
    await waitUntil(() => onGoToSettings.mock.calls.length === 1);
    expect(onPrimary).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
  });

  test("p jumps straight to provider settings", async () => {
    const onGoToSettings = vi.fn();
    const { stdin } = renderGate({ onGoToSettings });

    stdin.write("p");
    await waitUntil(() => onGoToSettings.mock.calls.length === 1);
  });

  test("Back stays reachable past the recovery action", async () => {
    const onGoToSettings = vi.fn();
    const { stdin, onBack } = renderGate({ onGoToSettings });

    stdin.write(ARROW_RIGHT);
    await flush();
    stdin.write(ARROW_RIGHT);
    await flush();
    stdin.write("\r");
    await waitUntil(() => onBack.mock.calls.length === 1);
    expect(onGoToSettings).not.toHaveBeenCalled();
  });

  test("without a settings action p does nothing and no recovery button renders", async () => {
    const { stdin, lastFrame, onPrimary, onBack } = renderGate();

    expect(lastFrame()).not.toContain("Configure Provider");

    stdin.write("p");
    await flush();
    expect(onPrimary).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
  });
});
