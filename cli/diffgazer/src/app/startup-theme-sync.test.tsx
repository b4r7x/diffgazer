import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { makeAllConfigurationsListResponse } from "@diffgazer/core/testing/provider-fixtures";
import { QueryClientProvider } from "@tanstack/react-query";
import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { flush } from "../testing/flush";
import { createTestQueryClient } from "../testing/query-client";
import type { TuiThemeName } from "../theme/palettes";
import { CliThemeProvider, useTheme } from "../theme/provider";
import { StartupThemeSync } from "./startup-theme-sync";

type InitResponse = Awaited<ReturnType<BoundApi["loadConfigurationInit"]>>;
type SettingsTheme = InitResponse["settings"]["theme"];

function makeInitResponse(theme: SettingsTheme): InitResponse {
  const shell = makeAllConfigurationsListResponse();
  return {
    schemaVersion: 2,
    configurations: shell.configurations,
    unrecognizedConfigurations: shell.unrecognizedConfigurations,
    selectedConfigurationId: shell.selectedConfigurationId,
    settings: {
      theme,
      defaultLenses: [],
      effectiveCallTokenCap: 49_152,
      reviewWallTimeCapMs: null,
      defaultProfile: null,
      severityThreshold: "low",
      secretsStorage: "file",
      agentExecution: "sequential",
      providerConsent: null,
    },
    project: {
      projectId: "project-1",
      path: "/tmp/repo",
      trust: null,
    },
  };
}

function makeDeferredInitApi(theme: SettingsTheme) {
  let resolveInit: (init: InitResponse) => void = () => {};
  const initPromise = new Promise<InitResponse>((resolve) => {
    resolveInit = resolve;
  });
  const loadConfigurationInit = vi
    .fn<BoundApi["loadConfigurationInit"]>()
    .mockReturnValue(initPromise);
  const getSettings = vi.fn<BoundApi["getSettings"]>();

  return {
    api: {
      ...createApi({ baseUrl: "http://localhost" }),
      loadConfigurationInit,
      getSettings,
    } satisfies BoundApi,
    resolveInit: () => resolveInit(makeInitResponse(theme)),
    getSettings,
  };
}

function ThemeProbe() {
  const { themeName } = useTheme();
  return <Text>theme:{themeName}</Text>;
}

function StartupThemeSyncHarness({
  children,
  api,
  initialTheme,
}: {
  children: ReactNode;
  api: BoundApi;
  initialTheme: TuiThemeName;
}) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      <ApiProvider value={api}>
        <CliThemeProvider initialTheme={initialTheme}>{children}</CliThemeProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StartupThemeSync", () => {
  it("applies the persisted init settings theme after configuration init resolves", async () => {
    const init = makeDeferredInitApi("light");
    const { lastFrame } = render(
      <StartupThemeSyncHarness api={init.api} initialTheme="dark">
        <StartupThemeSync />
        <ThemeProbe />
      </StartupThemeSyncHarness>,
    );

    expect(lastFrame()).toContain("theme:dark");
    init.resolveInit();

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("theme:light");
    });
    expect(init.getSettings).not.toHaveBeenCalled();
  });

  it("keeps the explicit CLI theme after init settings resolve", async () => {
    const init = makeDeferredInitApi("light");
    const { lastFrame } = render(
      <StartupThemeSyncHarness api={init.api} initialTheme="dark">
        <StartupThemeSync explicitTheme="dark" />
        <ThemeProbe />
      </StartupThemeSyncHarness>,
    );

    expect(lastFrame()).toContain("theme:dark");
    init.resolveInit();
    await flush();
    expect(lastFrame()).toContain("theme:dark");
    expect(init.getSettings).not.toHaveBeenCalled();
  });
});
