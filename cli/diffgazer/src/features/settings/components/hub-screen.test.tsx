import type { SettingsConfig } from "@diffgazer/core/schemas/config";
import { LEGACY_V1_HAS_API_KEY_PROPERTY } from "@diffgazer/core/schemas/config";
import { cleanup, render } from "ink-testing-library";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { makeConfigurationListResponse } from "../../providers/testing/fixtures";

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

const terminalDimensions = vi.hoisted(() => ({ current: { columns: 80, rows: 24 } }));

vi.mock("../../../hooks/use-terminal-dimensions", () => ({
  useTerminalDimensions: () => terminalDimensions.current,
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

const shellList = makeConfigurationListResponse();

function makeInitResponse() {
  return {
    schemaVersion: 2 as const,
    configurations: shellList.configurations,
    selectedConfigurationId: shellList.selectedConfigurationId,
    settings: SETTINGS,
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
  terminalDimensions.current = { columns: 80, rows: 24 };
});

const HUB_LABELS = [
  "Trust & Permissions",
  "Theme",
  "Provider",
  "Secrets Storage",
  "Agent Execution",
  "Analysis",
  "Diagnostics",
];

interface HubRow {
  label: string;
  trailingColumn: number;
  gapBeforeValue: number;
}

function readHubRows(frame: string): HubRow[] {
  const rows: HubRow[] = [];
  for (const line of stripAnsi(frame).split("\n")) {
    const start = line.indexOf("│");
    const end = line.lastIndexOf("│");
    if (start < 0 || end <= start) continue;
    const inner = line.slice(start + 1, end);
    const label = HUB_LABELS.find((candidate) => inner.trimStart().startsWith(candidate));
    if (!label) continue;
    const trimmed = inner.replace(/\s+$/, "");
    const leading = inner.length - inner.trimStart().length;
    const afterLabel = trimmed.slice(leading + label.length);
    rows.push({
      label,
      trailingColumn: trimmed.length,
      gapBeforeValue: afterLabel.length - afterLabel.trimStart().length,
    });
  }
  return rows;
}

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

    expect(view.lastFrame()).toContain("NOT TRUSTED");
    expect(view.lastFrame()).toContain("project path:");
    expect(view.lastFrame()).not.toMatch(new RegExp(LEGACY_V1_HAS_API_KEY_PROPERTY, "i"));
  });

  test("aligns every hub value to one trailing column without jamming the longest label", () => {
    terminalDimensions.current = { columns: 120, rows: 40 };
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

    const rows = readHubRows(view.lastFrame() ?? "");
    expect(rows).toHaveLength(HUB_LABELS.length);
    expect(new Set(rows.map((row) => row.trailingColumn)).size).toBe(1);
    for (const row of rows) {
      expect(row.gapBeforeValue).toBeGreaterThanOrEqual(2);
    }
  });
});
