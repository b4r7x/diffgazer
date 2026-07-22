import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import type { SetupStatus } from "@diffgazer/core/schemas/config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { NavigationProvider } from "../../../app/providers/navigation-provider";
import { useConfigGuard } from "../../../app/use-config-guard";
import { waitUntil } from "../../../testing/wait-until";
import { CliThemeProvider } from "../../../theme/provider";
import { ApiKeyMissingView } from "./api-key-missing-view";
import { ReviewContainer } from "./container";

const ARROW_RIGHT = "\u001b[C";
const ESCAPE = "\u001b";

afterEach(() => {
  cleanup();
});

async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function ConfigGuardProbe() {
  const state = useConfigGuard();

  return <Text>{`Config guard: ${state}`}</Text>;
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: "always" },
      mutations: { retry: false, networkMode: "always" },
    },
  });
}

describe("ApiKeyMissingView (TUI)", () => {
  test("lets keyboard users go back with Escape or the reachable Back button", async () => {
    const onGoToSettings = vi.fn();
    const onBack = vi.fn();
    const missing: SetupStatus["missing"] = ["provider"];
    const { stdin, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <FooterProvider initialShortcuts={[]}>
          <ApiKeyMissingView
            provider="gemini"
            missing={missing}
            onGoToSettings={onGoToSettings}
            onBack={onBack}
          />
        </FooterProvider>
      </CliThemeProvider>,
    );

    expect(lastFrame()).toContain("API Key Required");
    expect(lastFrame()).toContain("Configure Provider");
    expect(lastFrame()).toContain("Back");

    stdin.write(ESCAPE);
    await waitUntil(() => onBack.mock.calls.length === 1);

    expect(onBack).toHaveBeenCalledTimes(1);

    stdin.write(ARROW_RIGHT);
    await flush();
    stdin.write("\r");
    await waitUntil(() => onBack.mock.calls.length === 2);

    expect(onBack).toHaveBeenCalledTimes(2);
    expect(onGoToSettings).not.toHaveBeenCalled();
  });

  test("activates Configure Provider with Enter without needing to navigate to it first", async () => {
    const onGoToSettings = vi.fn();
    const onBack = vi.fn();
    const missing: SetupStatus["missing"] = ["provider"];
    const { stdin, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <FooterProvider initialShortcuts={[]}>
          <ApiKeyMissingView
            provider="gemini"
            missing={missing}
            onGoToSettings={onGoToSettings}
            onBack={onBack}
          />
        </FooterProvider>
      </CliThemeProvider>,
    );

    expect(lastFrame()).toContain("Configure Provider");

    stdin.write("\r");
    await waitUntil(() => onGoToSettings.mock.calls.length === 1);

    expect(onGoToSettings).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
  });

  test("offers a real init retry instead of guessing setup state after config-check succeeds", async () => {
    const recoveredInit: Awaited<ReturnType<BoundApi["loadInit"]>> = {
      configPath: "/tmp/diffgazer/config.json",
      config: { provider: "openrouter" },
      providers: [],
      settings: {
        theme: "dark",
        defaultLenses: [],
        defaultProfile: null,
        severityThreshold: "low",
        secretsStorage: "file",
        agentExecution: "sequential",
      },
      configured: false,
      project: {
        projectId: "project-1",
        path: "/tmp/repo",
        trust: null,
      },
      setup: {
        hasSecretsStorage: true,
        hasProvider: true,
        hasModel: false,
        hasTrust: true,
        isConfigured: false,
        isReady: false,
        missing: ["model"],
      },
    };
    let resolveRetry: (value: typeof recoveredInit) => void = () => {};
    const retryResult = new Promise<typeof recoveredInit>((resolve) => {
      resolveRetry = resolve;
    });
    const loadInit = vi
      .fn<BoundApi["loadInit"]>()
      .mockRejectedValueOnce(new Error("init unavailable"))
      .mockReturnValueOnce(retryResult);
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      checkConfig: vi.fn<BoundApi["checkConfig"]>().mockResolvedValue({
        configured: true,
        config: { provider: "openrouter", model: "openrouter/test-model" },
      }),
      getSettings: vi.fn<BoundApi["getSettings"]>().mockResolvedValue(recoveredInit.settings),
      loadInit,
    } satisfies BoundApi;

    const { stdin, lastFrame } = render(
      <QueryClientProvider client={makeQueryClient()}>
        <ApiProvider value={api}>
          <CliThemeProvider initialTheme="dark">
            <NavigationProvider initialRoute={{ screen: "review", mode: "staged" }}>
              <FooterProvider initialShortcuts={[]}>
                <ConfigGuardProbe />
                <ReviewContainer mode="staged" />
              </FooterProvider>
            </NavigationProvider>
          </CliThemeProvider>
        </ApiProvider>
      </QueryClientProvider>,
    );

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Config guard: configured");
      expect(lastFrame()).toContain("Configuration Unavailable");
    });
    expect(lastFrame()).not.toContain("API Key Required");
    expect(lastFrame()).not.toContain("Model Required");

    stdin.write("\r");

    await vi.waitFor(() => {
      expect(loadInit).toHaveBeenCalledTimes(2);
      expect(lastFrame()).toContain("Loading configuration...");
    });

    resolveRetry(recoveredInit);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Model Required");
    });
    expect(lastFrame()).not.toContain("Configuration Unavailable");
    expect(lastFrame()).not.toContain("API Key Required");
  });
});
