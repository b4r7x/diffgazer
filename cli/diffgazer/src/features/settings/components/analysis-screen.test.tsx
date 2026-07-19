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
});
