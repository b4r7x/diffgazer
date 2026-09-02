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
import { ApiBoundary } from "../../../testing/api-boundary";
import { flush } from "../../../testing/flush";
import { CliThemeProvider } from "../../../theme/provider";

const apiMocks = vi.hoisted(() => ({
  useConfigurationInit: vi.fn(),
  useSettings: vi.fn(),
  saveSettings: vi.fn(async () => {}),
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

// The provider data notice overlay sizes itself from the global layout's content zone.
vi.mock("../../../components/layout/global", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../components/layout/global")>();
  return {
    ...actual,
    useContentZone: () => ({
      columns: terminalDimensions.current.columns,
      contentColumns: terminalDimensions.current.columns,
      contentRows: actual.getContentZoneRows(terminalDimensions.current.rows),
    }),
  };
});

import { SettingsHubScreen } from "./hub-screen";

const SETTINGS: SettingsConfig = {
  theme: "dark",
  defaultLenses: ["security"],
  effectiveCallTokenCap: 49_152,
  reviewWallTimeCapMs: null,
  defaultProfile: null,
  severityThreshold: "low",
  secretsStorage: "file",
  agentExecution: "parallel",
  providerConsent: null,
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

function renderHub(settings: SettingsConfig = SETTINGS) {
  apiMocks.useConfigurationInit.mockReturnValue({
    data: makeInitResponse(),
    isLoading: false,
    error: null,
  });
  apiMocks.useSettings.mockReturnValue({
    data: settings,
    isLoading: false,
    error: null,
  });

  return render(
    <ApiBoundary api={{ saveSettings: apiMocks.saveSettings }}>
      <CliThemeProvider initialTheme="dark">
        <NavigationContext
          value={{ route: { screen: "settings" }, navigate, goBack, canGoBack: true }}
        >
          <FooterProvider>
            <SettingsHubScreen />
            <ConnectedFooter />
          </FooterProvider>
        </NavigationContext>
      </CliThemeProvider>
    </ApiBoundary>,
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
  "Provider data notice",
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

  test("opens the provider data notice from its row and offers the acceptance while none is on record", async () => {
    const view = renderHub();
    await flush();
    expect(stripAnsi(view.lastFrame() ?? "")).toMatch(/Provider data notice\s+NOT ACCEPTED/);

    // Fourth row: Trust, Theme, Provider, then the notice.
    for (const _row of ["theme", "provider", "notice"]) {
      view.stdin.write(DOWN);
      await flush();
    }
    view.stdin.write(ENTER);
    await flush();

    const frame = stripAnsi(view.lastFrame() ?? "");
    expect(frame).toContain("Provider data notice");
    expect(frame).toContain("[ Accept ]");
    expect(frame).toContain("[ Not now ]");
    expect(navigate).not.toHaveBeenCalled();

    view.stdin.write(ENTER);
    await vi.waitFor(() => expect(apiMocks.saveSettings).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(stripAnsi(view.lastFrame() ?? "")).toContain("SETTINGS HUB"));
  });

  test("keeps the notice row highlighted after the notice is declined", async () => {
    const view = renderHub();
    await flush();

    for (const _row of ["theme", "provider", "notice"]) {
      view.stdin.write(DOWN);
      await flush();
    }
    view.stdin.write(ENTER);
    await flush();
    expect(stripAnsi(view.lastFrame() ?? "")).toContain("[ Not now ]");

    view.stdin.write(ESCAPE);
    await vi.waitFor(() => expect(stripAnsi(view.lastFrame() ?? "")).toContain("SETTINGS HUB"));

    // Enter reopens the notice from the same row instead of opening the first row's screen.
    view.stdin.write(ENTER);
    await flush();
    expect(stripAnsi(view.lastFrame() ?? "")).toContain("[ Not now ]");
    expect(navigate).not.toHaveBeenCalled();
  });

  test("reads an accepted provider data notice back with its date and a Close action", async () => {
    const view = renderHub({
      ...SETTINGS,
      providerConsent: { version: 1, acceptedAt: "2026-08-18T10:00:00.000Z" },
    });
    await flush();
    expect(stripAnsi(view.lastFrame() ?? "")).toMatch(
      /Provider data notice\s+ACCEPTED 2026-08-1[89]/,
    );

    for (const _row of ["theme", "provider", "notice"]) {
      view.stdin.write(DOWN);
      await flush();
    }
    view.stdin.write(ENTER);
    await flush();

    const frame = stripAnsi(view.lastFrame() ?? "");
    expect(frame).toMatch(/Accepted 2026-08-1[89]/);
    expect(frame).toContain("[ Close ]");
    expect(frame).not.toContain("[ Accept ]");
    expect(frame).toContain("[Esc] Close");

    view.stdin.write(ESCAPE);
    await vi.waitFor(() => expect(stripAnsi(view.lastFrame() ?? "")).toContain("SETTINGS HUB"));
    expect(goBack).not.toHaveBeenCalled();
    expect(apiMocks.saveSettings).not.toHaveBeenCalled();
  });
});
