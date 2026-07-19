import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Text, useInput } from "ink";
import { cleanup, render } from "ink-testing-library";
import { type ReactNode, useContext, useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KeyboardContext } from "../hooks/use-keyboard";
import { useNavigation } from "../hooks/use-navigation";
import type { createServerFactories } from "../lib/servers/factories";
import { CliThemeProvider, useTheme } from "../theme/provider";
import { TerminalKeyboardProvider } from "./providers/keyboard";
import { NavigationProvider } from "./providers/navigation-provider";

type ServerFactoryOptions = Parameters<typeof createServerFactories>[0];

type FakeServerState =
  | { status: "checking" }
  | { status: "connected" }
  | { status: "error"; message: string };

const serverStatusState = vi.hoisted(() => ({
  current: { status: "error", message: "fetch failed" } as FakeServerState,
}));
const configCheckState = vi.hoisted(() => ({
  current: { data: undefined, error: null, isLoading: true },
}));
const retryMock = vi.hoisted(() => vi.fn<() => Promise<unknown>>(() => Promise.resolve(undefined)));
const refetchConfigMock = vi.hoisted(() => vi.fn(() => Promise.resolve(undefined)));
const startMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const stopMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const factory = vi.hoisted(() => ({
  options: undefined as ServerFactoryOptions | undefined,
  onStartupFailure: undefined as ((message: string) => void) | undefined,
}));

// Boundary mock: network - core api hooks wrap fetch-backed API calls.
vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@diffgazer/core/api/hooks")>();
  return {
    ...actual,
    useConfigCheck: () => ({ ...configCheckState.current, refetch: refetchConfigMock }),
    useServerStatus: () => ({ state: serverStatusState.current, retry: retryMock }),
  };
});

// Boundary mock: server factories start process/embedded HTTP servers; tests inject a controller to exercise HealthGate recovery.
vi.mock("../lib/servers/factories", () => ({
  createServerFactories: (options: ServerFactoryOptions) => {
    factory.options = options;
    factory.onStartupFailure = options.onStartupFailure;
    return [() => ({ start: startMock, stop: stopMock })];
  },
}));

import { App, GlobalShortcuts, StartupThemeSync } from "./root";

afterEach(() => {
  cleanup();
  serverStatusState.current = { status: "error", message: "fetch failed" };
  configCheckState.current = { data: undefined, error: null, isLoading: true };
  factory.options = undefined;
  factory.onStartupFailure = undefined;
  vi.clearAllMocks();
});

describe("App server configuration", () => {
  it("constructs servers with terminal-only behavior", () => {
    render(<App mode="prod" />);

    expect(factory.options).toMatchObject({
      mode: "prod",
      openBrowser: false,
      includeWebServer: false,
    });
  });
});

function BackCapabilityProbe() {
  const { canGoBack } = useNavigation();
  return <Text>{canGoBack ? "route-back-enabled" : "route-back-disabled"}</Text>;
}

describe("NavigationProvider back capability", () => {
  it("does not advertise a route-back action during onboarding", () => {
    const { lastFrame } = render(
      <NavigationProvider initialRoute={{ screen: "onboarding" }}>
        <BackCapabilityProbe />
      </NavigationProvider>,
    );

    expect(lastFrame()).toContain("route-back-disabled");
  });
});

interface KeyboardProbeProps {
  onCtrlC: () => void;
  onNavigate: () => void;
}

function KeyboardProbe({ onCtrlC, onNavigate }: KeyboardProbeProps) {
  const keyboard = useContext(KeyboardContext);
  const { route } = useNavigation();

  useEffect(() => keyboard?.registerGlobalHandler("up", onNavigate), [keyboard, onNavigate]);
  useInput((input, key) => {
    if (input === "c" && key.ctrl) onCtrlC();
  });

  return <Text>route:{route.screen}</Text>;
}

function StreamingReviewProbe({ onCancel }: { onCancel: () => void }) {
  const keyboard = useContext(KeyboardContext);

  useEffect(() => {
    keyboard?.setReviewStreaming(true, onCancel);
    return () => keyboard?.setReviewStreaming(false);
  }, [keyboard, onCancel]);

  return <Text>Progress Overview</Text>;
}

function KeyboardHarness({
  onCtrlC = () => {},
  onExit = () => {},
  onNavigate = () => {},
  isStreaming = false,
  onCancel = () => {},
}: {
  onCtrlC?: () => void;
  onExit?: () => void;
  onNavigate?: () => void;
  isStreaming?: boolean;
  onCancel?: () => void;
}) {
  return (
    <TerminalKeyboardProvider>
      <NavigationProvider initialRoute={isStreaming ? { screen: "review", live: true } : undefined}>
        <GlobalShortcuts onExit={onExit} />
        <KeyboardProbe onCtrlC={onCtrlC} onNavigate={onNavigate} />
        {isStreaming ? <StreamingReviewProbe onCancel={onCancel} /> : null}
      </NavigationProvider>
    </TerminalKeyboardProvider>
  );
}

describe("GlobalShortcuts terminal input", () => {
  it.each([
    { input: "s", route: "settings", exits: false },
    { input: "?", route: "help", exits: false },
    { input: "q", route: "home", exits: true },
  ])("handles bare '$input'", async ({ input, route, exits }) => {
    const onExit = vi.fn();
    const { lastFrame, stdin } = render(<KeyboardHarness onExit={onExit} />);
    await flush();

    stdin.write(input);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain(`route:${route}`);
      expect(onExit).toHaveBeenCalledTimes(exits ? 1 : 0);
    });
  });

  it.each([
    { label: "Ctrl+S", input: "\u001b[115;5u" },
    { label: "Ctrl+Q", input: "\u001b[113;5u" },
    { label: "Ctrl+?", input: "\u001b[63;5u" },
    { label: "Alt+S", input: "\u001b[115;3u" },
    { label: "Alt+Q", input: "\u001b[113;3u" },
    { label: "Alt+?", input: "\u001b[63;3u" },
    { label: "Meta+S", input: "\u001b[115;33u" },
    { label: "Meta+Q", input: "\u001b[113;33u" },
    { label: "Meta+?", input: "\u001b[63;33u" },
  ])("ignores $label as a bare global shortcut", async ({ input }) => {
    const onExit = vi.fn();
    const { lastFrame, stdin } = render(<KeyboardHarness onExit={onExit} />);
    await flush();

    stdin.write(input);
    await flush();

    expect(lastFrame()).toContain("route:home");
    expect(onExit).not.toHaveBeenCalled();
  });

  it("leaves Ctrl+C available to the dedicated exit handler", async () => {
    const onCtrlC = vi.fn();
    const { stdin } = render(<KeyboardHarness onCtrlC={onCtrlC} />);
    await flush();

    stdin.write("\u0003");

    await vi.waitFor(() => expect(onCtrlC).toHaveBeenCalledTimes(1));
  });

  it("preserves modified navigation keys", async () => {
    const onNavigate = vi.fn();
    const { stdin } = render(<KeyboardHarness onNavigate={onNavigate} />);
    await flush();

    stdin.write("\u001b[1;5A");

    await vi.waitFor(() => expect(onNavigate).toHaveBeenCalledTimes(1));
  });

  it("keeps a streaming review on screen when q is pressed", async () => {
    const onExit = vi.fn();
    const onCancel = vi.fn();
    const { stdin, lastFrame } = render(
      <KeyboardHarness isStreaming onExit={onExit} onCancel={onCancel} />,
    );
    await flush();

    stdin.write("q");
    await flush();

    expect(lastFrame()).toContain("route:review");
    expect(lastFrame()).toContain("Progress Overview");
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onExit).not.toHaveBeenCalled();
  });
});

describe("HealthGate startup-failure recovery", () => {
  it("waits for fresh readiness before one health refetch after startup fails", async () => {
    startMock.mockRejectedValueOnce(new Error("readiness failed"));
    const { stdin, lastFrame } = render(<App mode="prod" />);

    await vi.waitFor(() => {
      expect(startMock).toHaveBeenCalledOnce();
      expect(lastFrame()).toContain("Press r to retry");
    });

    const startsBefore = startMock.mock.calls.length;
    let resolveReadiness = () => {};
    const readiness = new Promise<void>((resolve) => {
      resolveReadiness = resolve;
    });
    let resolveHealth = () => {};
    const health = new Promise<void>((resolve) => {
      resolveHealth = resolve;
    });
    startMock.mockReturnValueOnce(readiness);
    retryMock.mockReturnValueOnce(health);

    stdin.write("r");

    await vi.waitFor(() => {
      expect(startMock.mock.calls.length).toBeGreaterThan(startsBefore);
      expect(lastFrame()).toContain("Connecting to server");
    });
    expect(retryMock).not.toHaveBeenCalled();

    resolveReadiness();
    await vi.waitFor(() => expect(retryMock).toHaveBeenCalledOnce());
    serverStatusState.current = { status: "connected" };
    expect(lastFrame()).toContain("Connecting to server");

    resolveHealth();
    await vi.waitFor(() => expect(lastFrame()).toContain("Checking configuration"));
    expect(retryMock).toHaveBeenCalledOnce();
  });

  it("surfaces the real bind error when the embedded server fails to start", async () => {
    const { lastFrame, rerender } = render(<App mode="prod" />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Server Disconnected");
    });

    factory.onStartupFailure?.(
      "Port 3000 is already in use. Close the other process or set a different PORT.",
    );
    rerender(<App mode="prod" />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Server Failed to Start");
      expect(lastFrame()).toContain("Port 3000 is already in use");
    });
    expect(lastFrame()).not.toContain("Server Disconnected");
  });

  it("transitions past the health gate once the server reports connected", async () => {
    serverStatusState.current = { status: "connected" };

    const { lastFrame } = render(<App mode="prod" />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Checking configuration");
    });
    expect(lastFrame()).not.toContain("Press r to retry");
  });
});

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

describe("StartupThemeSync", () => {
  it("resolves the advertised high-contrast CLI theme to its named palette", () => {
    const settings = makeDeferredSettingsApi("light");
    const { lastFrame } = render(
      <StartupThemeSyncHarness api={settings.api} initialTheme="high-contrast">
        <ThemeProbe />
      </StartupThemeSyncHarness>,
    );

    expect(lastFrame()).toContain("theme:high-contrast");
  });

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
