import type { DiagnosticsData } from "@diffgazer/core/api/hooks";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";

const ARROW_RIGHT = "\u001B[C";

type RefreshAllDiagnostics = (
  data: Pick<DiagnosticsData, "retryServer" | "refetchContext">,
) => Promise<PromiseSettledResult<unknown>[]>;

const diagnosticsDataMock = vi.hoisted(() => vi.fn<() => DiagnosticsData>());
const refreshAllDiagnosticsMock = vi.hoisted(() => vi.fn<RefreshAllDiagnostics>());

vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@diffgazer/core/api/hooks")>();
  return {
    ...actual,
    refreshAllDiagnostics: refreshAllDiagnosticsMock,
    useDiagnosticsData: diagnosticsDataMock,
  };
});

vi.mock("@diffgazer/core/footer", () => ({
  usePageFooter: vi.fn(),
}));

vi.mock("../../../hooks/use-back-handler", () => ({
  useBackHandler: vi.fn(),
}));

vi.mock("../../../hooks/use-terminal-dimensions", () => ({
  useTerminalDimensions: () => ({ columns: 80, rows: 24 }),
}));

import { DiagnosticsScreen } from "./diagnostics-screen";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function makeDiagnosticsData(overrides: Partial<DiagnosticsData> = {}): DiagnosticsData {
  return {
    serverState: { status: "connected" },
    retryServer: vi.fn().mockResolvedValue(undefined),
    setupStatus: {
      hasSecretsStorage: true,
      hasProvider: true,
      hasModel: true,
      hasTrust: true,
      isConfigured: true,
      isReady: true,
      missing: [],
    },
    initLoading: false,
    initError: null,
    contextStatus: "ready",
    contextGeneratedAt: "2026-07-03T00:00:00.000Z",
    contextError: null,
    canRegenerate: true,
    handleRefreshContext: vi.fn(),
    isRefreshingContext: false,
    refetchContext: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("DiagnosticsScreen", () => {
  test("keeps button focus after Tab when no list zone exists", async () => {
    const handleRefreshContext = vi.fn();
    diagnosticsDataMock.mockReturnValue(makeDiagnosticsData({ handleRefreshContext }));
    refreshAllDiagnosticsMock.mockResolvedValue([]);

    const view = render(
      <CliThemeProvider initialTheme="dark">
        <DiagnosticsScreen />
      </CliThemeProvider>,
    );

    await flush();
    view.stdin.write(ARROW_RIGHT);
    await flush();
    view.stdin.write("\t");
    await flush();
    view.stdin.write("\r");
    await flush();

    expect(handleRefreshContext).toHaveBeenCalledTimes(1);
    expect(refreshAllDiagnosticsMock).not.toHaveBeenCalled();
  });
});
