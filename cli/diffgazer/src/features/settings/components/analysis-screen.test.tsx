import { SETTINGS_SCREEN_COPY } from "@diffgazer/core/schemas/config";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";

const apiMocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  useSettings: vi.fn(),
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
  useNavigation: () => ({ goBack: vi.fn() }),
}));

vi.mock("../../../hooks/use-terminal-dimensions", () => ({
  useTerminalDimensions: () => ({ columns: 80, rows: 24 }),
}));

import { AnalysisScreen } from "./analysis-screen";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function flush(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

const ARROW_DOWN = "\u001B[B";
const ARROW_UP = "\u001B[A";
const ARROW_RIGHT = "\u001B[C";
const BACKSPACE = "\u007f";

/** Steps past the five lens rows onto the token-cap field, then replaces its value. */
async function typeIntoCapField(view: ReturnType<typeof render>, digits: string): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    view.stdin.write(ARROW_DOWN);
    await flush();
  }
  for (let i = 0; i < 5; i += 1) {
    view.stdin.write(BACKSPACE);
    await flush();
  }
  view.stdin.write(digits);
  await flush();
}

describe("AnalysisScreen", () => {
  test("uses fallback lenses and saves the changed selection", async () => {
    apiMocks.useSettings.mockReturnValue({
      data: { defaultLenses: [] },
      error: null,
      isLoading: false,
    });
    const view = render(
      <CliThemeProvider initialTheme="dark">
        <AnalysisScreen />
      </CliThemeProvider>,
    );

    expect(view.lastFrame()).toContain(SETTINGS_SCREEN_COPY.analysis.title.toUpperCase());
    expect(view.lastFrame()).toContain("[x]");
    expect(view.lastFrame()).toContain("Save");

    view.stdin.write(" ");
    await flush();
    view.stdin.write("\t");
    await flush();
    view.stdin.write("\u001B[C");
    await flush();
    view.stdin.write("\r");
    await flush();

    expect(apiMocks.mutate).toHaveBeenCalledWith(
      { defaultLenses: ["security", "performance", "simplicity", "tests"] },
      expect.any(Object),
    );
  });

  test("round-trips the per-call token cap through the save payload", async () => {
    apiMocks.useSettings.mockReturnValue({
      data: { defaultLenses: ["correctness"], effectiveCallTokenCap: 49152 },
      error: null,
      isLoading: false,
    });
    const view = render(
      <CliThemeProvider initialTheme="dark">
        <AnalysisScreen />
      </CliThemeProvider>,
    );

    expect(view.lastFrame()).toContain("Per-call token cap");
    expect(view.lastFrame()).toContain("49152");

    await typeIntoCapField(view, "65536");
    expect(view.lastFrame()).toContain("65536");

    view.stdin.write("\t");
    await flush();
    view.stdin.write(ARROW_RIGHT);
    await flush();
    view.stdin.write("\r");
    await flush();

    expect(apiMocks.mutate).toHaveBeenCalledWith(
      { defaultLenses: ["correctness"], effectiveCallTokenCap: 65536 },
      expect.any(Object),
    );
  });

  test("refuses an out-of-range token cap instead of saving it", async () => {
    apiMocks.useSettings.mockReturnValue({
      data: { defaultLenses: ["correctness"], effectiveCallTokenCap: 49152 },
      error: null,
      isLoading: false,
    });
    const view = render(
      <CliThemeProvider initialTheme="dark">
        <AnalysisScreen />
      </CliThemeProvider>,
    );

    // Toggle a second lens on so the save is blocked by the invalid cap alone, not by a clean form.
    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(" ");
    await flush();
    view.stdin.write(ARROW_UP);
    await flush();

    await typeIntoCapField(view, "999");
    expect(view.lastFrame()).toContain("Enter a whole number between 16384 and 1048576.");

    view.stdin.write("\t");
    await flush();
    view.stdin.write(ARROW_RIGHT);
    await flush();
    view.stdin.write("\r");
    await flush();

    expect(apiMocks.mutate).not.toHaveBeenCalled();
  });
});
