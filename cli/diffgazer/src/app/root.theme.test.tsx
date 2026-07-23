import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CliThemeProvider, useTheme } from "../theme/provider";
import { StartupThemeSync } from "./root";

type SettingsResponse = Awaited<ReturnType<BoundApi["getSettings"]>>;
type SettingsTheme = SettingsResponse["theme"];

function makeSettings(theme: SettingsTheme) {
  return {
    theme,
    defaultLenses: [],
    defaultProfile: null,
    severityThreshold: "low",
    secretsStorage: "file",
    agentExecution: "sequential",
  } satisfies SettingsResponse;
}

function makeDeferredSettingsApi(theme: SettingsTheme) {
  let resolveSettings: (settings: SettingsResponse) => void = () => {};
  const settingsPromise = new Promise<SettingsResponse>((resolve) => {
    resolveSettings = resolve;
  });
  const getSettings = vi.fn<BoundApi["getSettings"]>().mockReturnValue(settingsPromise);

  return {
    api: { ...createApi({ baseUrl: "http://localhost" }), getSettings } satisfies BoundApi,
    resolveSettings: () => resolveSettings(makeSettings(theme)),
  };
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: "always" },
      mutations: { retry: false, networkMode: "always" },
    },
  });
}

function ThemeProbe() {
  const { themeName } = useTheme();
  return <Text>theme:{themeName}</Text>;
}

async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function StartupThemeSyncHarness({
  children,
  api,
  initialTheme,
}: {
  children: ReactNode;
  api: BoundApi;
  initialTheme: string;
}) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
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
  it("applies the persisted settings theme after settings resolve", async () => {
    const settings = makeDeferredSettingsApi("light");
    const { lastFrame } = render(
      <StartupThemeSyncHarness api={settings.api} initialTheme="dark">
        <StartupThemeSync />
        <ThemeProbe />
      </StartupThemeSyncHarness>,
    );

    expect(lastFrame()).toContain("theme:dark");
    settings.resolveSettings();

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("theme:light");
    });
  });

  it("keeps the explicit CLI theme after settings resolve", async () => {
    const settings = makeDeferredSettingsApi("light");
    const { lastFrame } = render(
      <StartupThemeSyncHarness api={settings.api} initialTheme="dark">
        <StartupThemeSync explicitTheme="dark" />
        <ThemeProbe />
      </StartupThemeSyncHarness>,
    );

    expect(lastFrame()).toContain("theme:dark");
    settings.resolveSettings();
    await flush();
    expect(lastFrame()).toContain("theme:dark");
  });
});
