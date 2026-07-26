import { SETTINGS_SCREEN_COPY } from "@diffgazer/core/schemas/config";
import { cleanup, render } from "ink-testing-library";
import { afterAll, afterEach, describe, expect, test, vi } from "vitest";
import { flush } from "../../../testing/flush";
import { frameForegrounds } from "../../../testing/frame-colors";
import { darkPalette } from "../../../theme/palettes";
import { CliThemeProvider } from "../../../theme/provider";

// Ink reads colour support from the environment when it first imports chalk,
// which happens above this file's own imports.
const restoreForceColor = vi.hoisted(() => {
  const previous = process.env.FORCE_COLOR;
  process.env.FORCE_COLOR = "3";
  return () => {
    if (previous === undefined) delete process.env.FORCE_COLOR;
    else process.env.FORCE_COLOR = previous;
  };
});

afterAll(restoreForceColor);

const apiMocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  useSettings: vi.fn(),
  goBack: vi.fn(),
}));

vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@diffgazer/core/api/hooks")>();
  return {
    ...actual,
    useSaveSettings: () => ({ isPending: false, mutate: apiMocks.mutate }),
    useSettings: apiMocks.useSettings,
  };
});

vi.mock("@diffgazer/core/footer", () => ({
  usePageFooter: vi.fn(),
}));

vi.mock("../../../hooks/use-back-handler", () => ({
  useBackHandler: vi.fn(),
}));

vi.mock("../../../hooks/use-navigation", () => ({
  useNavigation: () => ({ goBack: apiMocks.goBack }),
}));

vi.mock("../../../hooks/use-terminal-dimensions", () => ({
  useTerminalDimensions: () => ({ columns: 80, rows: 24 }),
}));

import { AgentExecutionScreen } from "./agent-execution-screen";

const DOWN = "\u001B[B";
const RIGHT = "\u001B[C";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderScreen() {
  apiMocks.useSettings.mockReturnValue({
    data: { agentExecution: "sequential" },
    error: null,
    isLoading: false,
  });
  return render(
    <CliThemeProvider initialTheme="dark">
      <AgentExecutionScreen />
    </CliThemeProvider>,
  );
}

describe("AgentExecutionScreen", () => {
  test("heads the screen with the shared settings copy", () => {
    const view = renderScreen();

    expect(view.lastFrame()).toContain(SETTINGS_SCREEN_COPY["agent-execution"].title.toUpperCase());
  });

  test("keeps Save inert until the mode changes", async () => {
    const view = renderScreen();

    expect(view.lastFrame()).toContain("Sequential");
    expect(view.lastFrame()).toContain("Parallel");
    expect(view.lastFrame()).toContain("Save");
    // Save is rendered in the disabled tone, not merely unwired: the success
    // hue it carries once a change makes it live is absent from the frame.
    expect(frameForegrounds(view.lastFrame() ?? "")).toContain(darkPalette.muted);
    expect(frameForegrounds(view.lastFrame() ?? "")).not.toContain(darkPalette.success);

    view.stdin.write("\t");
    await flush();
    view.stdin.write(RIGHT);
    await flush();
    view.stdin.write("\r");
    await flush();

    expect(apiMocks.mutate).not.toHaveBeenCalled();
    expect(frameForegrounds(view.lastFrame() ?? "")).not.toContain(darkPalette.success);
  });

  test("saves the changed mode and navigates back on success", async () => {
    apiMocks.mutate.mockImplementation(
      (_settings: unknown, callbacks?: { onSuccess?: () => void }) => callbacks?.onSuccess?.(),
    );
    const view = renderScreen();

    view.stdin.write(DOWN);
    await flush();
    view.stdin.write("\r");
    await flush();
    // The change makes Save live, so it leaves the disabled tone for its own hue.
    expect(frameForegrounds(view.lastFrame() ?? "")).toContain(darkPalette.success);
    view.stdin.write(DOWN);
    await flush();
    view.stdin.write(RIGHT);
    await flush();
    view.stdin.write("\r");
    await flush();

    expect(apiMocks.mutate).toHaveBeenCalledWith(
      { agentExecution: "parallel" },
      expect.any(Object),
    );
    expect(apiMocks.goBack).toHaveBeenCalledTimes(1);
  });

  test("surfaces a sanitized save error above the actions", async () => {
    apiMocks.mutate.mockImplementation(
      (_settings: unknown, callbacks?: { onError?: (error: Error) => void }) =>
        callbacks?.onError?.(new Error("agent execution \u001B[31msave failed\u001B[0m")),
    );
    const view = renderScreen();

    view.stdin.write(DOWN);
    await flush();
    view.stdin.write("\r");
    await flush();
    view.stdin.write("\t");
    await flush();
    view.stdin.write(RIGHT);
    await flush();
    view.stdin.write("\r");
    await flush();

    const frame = view.lastFrame() ?? "";
    expect(frame).toContain("agent execution save failed");
    expect(frame).not.toContain("\u001B[31m");
    expect(frame.indexOf("agent execution save failed")).toBeLessThan(frame.indexOf("Cancel"));
  });
});
