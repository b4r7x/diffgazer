import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import type { SettingsConfig } from "@diffgazer/core/schemas/config";
import { LEGACY_V1_HAS_API_KEY_PROPERTY } from "@diffgazer/core/schemas/config";
import { SETTINGS_SHORTCUTS } from "@diffgazer/core/schemas/presentation";
import { makeAllConfigurationsListResponse } from "@diffgazer/core/testing/provider-fixtures";
import { cleanup, render } from "ink-testing-library";
import type { ReactElement } from "react";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Footer } from "../../../components/layout/footer";
import { NavigationContext } from "../../../hooks/use-navigation";
import { flush } from "../../../testing/flush";
import { CliThemeProvider } from "../../../theme/provider";

const apiMocks = vi.hoisted(() => ({
  useConfigurationInit: vi.fn(),
  useSettings: vi.fn(),
}));

vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@diffgazer/core/api/hooks")>();
  return {
    ...actual,
    useConfigurationInit: apiMocks.useConfigurationInit,
    useSettings: apiMocks.useSettings,
  };
});

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

const shellList = makeAllConfigurationsListResponse();

const DOWN = "\u001B[B";
const ENTER = "\r";
const ESCAPE = "\u001B";

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

const navigate = vi.fn();
const goBack = vi.fn();

/** Mirrors `ConnectedFooter` in the global layout: the footer the hub publishes to. */
function ConnectedFooter(): ReactElement {
  const { shortcuts, rightShortcuts } = useFooterData();
  return <Footer shortcuts={shortcuts} rightShortcuts={rightShortcuts} />;
}

function renderHub() {
  apiMocks.useConfigurationInit.mockReturnValue({
    data: makeInitResponse(),
    isLoading: false,
    error: null,
  });
  apiMocks.useSettings.mockReturnValue({
    data: SETTINGS,
    isLoading: false,
    error: null,
  });

  return render(
    <CliThemeProvider initialTheme="dark">
      <NavigationContext
        value={{ route: { screen: "settings" }, navigate, goBack, canGoBack: true }}
      >
        <FooterProvider>
          <SettingsHubScreen />
          <ConnectedFooter />
        </FooterProvider>
      </NavigationContext>
    </CliThemeProvider>,
  );
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
    const view = renderHub();

    expect(view.lastFrame()).toContain("NOT TRUSTED");
    expect(view.lastFrame()).toContain("project path:");
    expect(view.lastFrame()).not.toMatch(new RegExp(LEGACY_V1_HAS_API_KEY_PROPERTY, "i"));
  });

  test("aligns every hub value to one trailing column without jamming the longest label", () => {
    terminalDimensions.current = { columns: 120, rows: 40 };

    const view = renderHub();

    const rows = readHubRows(view.lastFrame() ?? "");
    expect(rows).toHaveLength(HUB_LABELS.length);
    expect(new Set(rows.map((row) => row.trailingColumn)).size).toBe(1);
    for (const row of rows) {
      expect(row.gapBeforeValue).toBeGreaterThanOrEqual(2);
    }
  });

  test("publishes its shortcuts to the shared footer", async () => {
    const view = renderHub();
    await flush();

    const frame = stripAnsi(view.lastFrame() ?? "");
    for (const { key, label } of SETTINGS_SHORTCUTS) {
      expect(frame).toContain(`[${key}] ${label}`);
    }
    // The provider's default legend, proving the screen published its own.
    expect(frame).not.toContain("[?] Help");
  });

  test("handles every key the footer advertises", async () => {
    const view = renderHub();
    await flush();

    // [↑/↓] Navigate, then [Enter] Edit: the second row opens the theme screen.
    view.stdin.write(DOWN);
    await flush();
    view.stdin.write(ENTER);
    await flush();

    expect(navigate).toHaveBeenCalledExactlyOnceWith({ screen: "settings/theme" });

    // [Esc] Back. Ink holds a bare Escape for 20ms to tell it apart from the
    // start of a control sequence, so this one waits on a timer, not a frame.
    view.stdin.write(ESCAPE);

    await vi.waitFor(() => expect(goBack).toHaveBeenCalledTimes(1));
  });
});
