import type { InitResponse, SettingsConfig } from "@diffgazer/core/schemas/config";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";

const apiMocks = vi.hoisted(() => ({
  useInit: vi.fn(),
  useSettings: vi.fn(),
}));

vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@diffgazer/core/api/hooks")>();
  return {
    ...actual,
    useInit: apiMocks.useInit,
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
  useNavigation: () => ({ navigate: vi.fn() }),
}));

vi.mock("../../../hooks/use-terminal-dimensions", () => ({
  useTerminalDimensions: () => ({ columns: 80, rows: 24 }),
}));

import { SettingsHubScreen } from "./hub-screen";

const SETTINGS: SettingsConfig = {
  theme: "dark",
  defaultLenses: ["security"],
  defaultProfile: null,
  severityThreshold: "low",
  secretsStorage: "file",
  agentExecution: "parallel",
};

function makeInitResponse(): InitResponse {
  return {
    config: { provider: "openrouter", model: "openrouter/test-model" },
    providers: [{ provider: "openrouter", hasApiKey: true, isActive: true }],
    settings: SETTINGS,
    configured: true,
    project: {
      projectId: "proj-1",
      path: "/work/moved-repo",
      trust: {
        projectId: "proj-1",
        repoRoot: "/work/repo",
        trustedAt: "2026-01-01T00:00:00.000Z",
        trustMode: "persistent",
        capabilities: { readFiles: true, runCommands: false },
      },
    },
    setup: {
      hasSecretsStorage: true,
      hasProvider: true,
      hasModel: true,
      hasTrust: true,
      isConfigured: true,
      isReady: true,
      missing: [],
    },
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SettingsHubScreen", () => {
  test("shows not trusted when repository access belongs to the previous root", () => {
    apiMocks.useInit.mockReturnValue({
      data: makeInitResponse(),
      isLoading: false,
      error: null,
    });
    apiMocks.useSettings.mockReturnValue({
      data: SETTINGS,
      isLoading: false,
      error: null,
    });

    const view = render(
      <CliThemeProvider initialTheme="dark">
        <SettingsHubScreen />
      </CliThemeProvider>,
    );

    expect(view.lastFrame()).toContain("Not trusted");
  });
});
