/**
 * @vitest-environment jsdom
 */
import type { BoundApi } from "@diffgazer/core/api";
import { renderHook, waitFor } from "@testing-library/react";
import { cleanup as cleanupInk, render as renderInk } from "ink-testing-library";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useNavigation } from "../hooks/use-navigation";
import { CliThemeProvider } from "../theme/provider";
import { NavigationProvider } from "./providers/navigation-provider";

const useConfigCheckMock = vi.hoisted(() => vi.fn());
const useInitMock = vi.hoisted(() => vi.fn());
const refetchInitMock = vi.hoisted(() => vi.fn(() => Promise.resolve(undefined)));
const refetchConfigMock = vi.hoisted(() => vi.fn(() => Promise.resolve(undefined)));
const saveTrustMock = vi.hoisted(() => ({
  error: null,
  isPending: false,
  mutate: () => {},
}));

// Boundary mock: network - core api hooks wrap fetch-backed API calls.
vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@diffgazer/core/api/hooks")>();
  return {
    ...actual,
    useConfigCheck: useConfigCheckMock,
    useInit: useInitMock,
    useServerStatus: () => ({
      state: { status: "ready" },
      retry: () => Promise.resolve(),
    }),
    useReviews: () => ({ data: { reviews: [] } }),
    useActiveReviewSession: () => ({ data: { session: null } }),
    useSaveTrust: () => saveTrustMock,
    useShutdown: () => ({ mutate: () => {} }),
  };
});

vi.mock("@diffgazer/core/footer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@diffgazer/core/footer")>();
  return { ...actual, usePageFooter: () => {} };
});
vi.mock("../hooks/use-back-handler", () => ({ useBackHandler: () => {} }));
vi.mock("../hooks/use-exit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hooks/use-exit")>();
  return { ...actual, useExit: () => ({ handleExit: () => {} }) };
});
vi.mock("../hooks/use-terminal-dimensions", () => ({
  useResponsive: () => ({ columns: 100, rows: 30, isNarrow: false }),
  useTerminalDimensions: () => ({ columns: 100, rows: 30 }),
}));
vi.mock("./providers/server", () => ({
  ServerProvider: ({ children }: { children: ReactNode }) => children,
  useServerControls: () => ({ restartServers: () => Promise.resolve() }),
}));

import { HomeScreen } from "../features/home/components/screen";
import { App, ConfigGate } from "./root";
import { useConfigGuard } from "./use-config-guard";

const CONFIGURED_QUERY = {
  data: { configured: true },
  isLoading: false,
  error: null,
  refetch: refetchConfigMock,
};

function makeInitResponse(): Awaited<ReturnType<BoundApi["loadInit"]>> {
  return {
    configPath: "/tmp/diffgazer/config.json",
    config: { provider: "openrouter", model: "openrouter/test-model" },
    providers: [],
    settings: {
      theme: "dark",
      defaultLenses: [],
      defaultProfile: null,
      severityThreshold: "low",
      secretsStorage: "file",
      agentExecution: "sequential",
    },
    configured: true,
    project: {
      projectId: "project-1",
      path: "/tmp/repo",
      trust: null,
    },
    setup: {
      hasSecretsStorage: true,
      hasProvider: true,
      hasModel: true,
      hasTrust: false,
      isConfigured: true,
      isReady: false,
      missing: ["trust"],
    },
  };
}

function guardedHomeElement() {
  const gate = createElement(
    ConfigGate,
    {} as Parameters<typeof ConfigGate>[0],
    createElement(HomeScreen),
  );
  const navigation = createElement(
    NavigationProvider,
    { initialRoute: { screen: "home" } } as Parameters<typeof NavigationProvider>[0],
    gate,
  );
  return createElement(
    CliThemeProvider,
    { initialTheme: "dark" } as Parameters<typeof CliThemeProvider>[0],
    navigation,
  );
}

function renderGuardedHome() {
  return renderInk(guardedHomeElement());
}

describe("useConfigGuard", () => {
  beforeEach(() => {
    useConfigCheckMock.mockReset();
    useInitMock.mockReset();
    refetchInitMock.mockClear();
    refetchConfigMock.mockClear();
  });

  afterEach(() => {
    cleanupInk();
  });

  test("returns api-error instead of redirecting when the config check fails", () => {
    useConfigCheckMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("network down"),
    });

    const { result } = renderHook(() => useGuardAndRoute(), { wrapper: TestNavigationProvider });

    expect(result.current.state).toBe("api-error");
    expect(result.current.route.screen).toBe("home");
  });

  test("redirects to onboarding only when the API reports not configured", async () => {
    useConfigCheckMock.mockReturnValue({
      data: { configured: false },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useGuardAndRoute(), { wrapper: TestNavigationProvider });

    expect(result.current.state).toBe("not-configured");
    await waitFor(() => {
      expect(result.current.route.screen).toBe("onboarding");
    });
  });

  test("does not mount Home queries while the onboarding redirect is pending", () => {
    useConfigCheckMock.mockReturnValue({
      data: { configured: false },
      isLoading: false,
      error: null,
      refetch: refetchConfigMock,
    });

    renderInk(createElement(App, { mode: "prod" }));

    expect(useInitMock).not.toHaveBeenCalled();
  });

  test("gates Home before showing a sanitized actionable init error", async () => {
    useConfigCheckMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: refetchConfigMock,
    });
    useInitMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("init endpoint \u001b[31munavailable\u001b[0m"),
      refetch: refetchInitMock,
    });

    const view = renderGuardedHome();

    expect(view.lastFrame()).toContain("Checking configuration");
    expect(view.lastFrame()).not.toContain("Home Data Unavailable");

    useConfigCheckMock.mockReturnValue(CONFIGURED_QUERY);
    view.rerender(guardedHomeElement());

    await waitFor(() => expect(view.lastFrame()).toContain("Home Data Unavailable"));
    expect(view.lastFrame()).toContain("init endpoint unavailable");
    expect(view.lastFrame()).toContain("Press r to retry");
    expect(view.lastFrame()).not.toContain("\u001b");
    expect(view.lastFrame()).not.toContain("Not trusted");
    expect(view.lastFrame()).not.toContain("Not configured");
    expect(view.lastFrame()).not.toContain("Trust This Repository?");

    view.stdin.write("r");
    await waitFor(() => expect(refetchInitMock).toHaveBeenCalledTimes(1));
    expect(refetchConfigMock).not.toHaveBeenCalled();
  });

  test("keeps Home in loading state after the config check succeeds", () => {
    useConfigCheckMock.mockReturnValue(CONFIGURED_QUERY);
    useInitMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: refetchInitMock,
    });

    const view = renderGuardedHome();

    expect(view.lastFrame()).toContain("Loading home data");
    expect(view.lastFrame()).not.toContain("Home Data Unavailable");
    expect(view.lastFrame()).not.toContain("Not trusted");
    expect(view.lastFrame()).not.toContain("Not configured");
    expect(view.lastFrame()).not.toContain("Trust This Repository?");
  });

  test("treats loaded trust:null as a real trust prompt", () => {
    useConfigCheckMock.mockReturnValue(CONFIGURED_QUERY);
    useInitMock.mockReturnValue({
      data: { ...makeInitResponse(), config: { provider: "openai", model: null } },
      isLoading: false,
      error: null,
      refetch: refetchInitMock,
    });

    const view = renderGuardedHome();

    expect(view.lastFrame()).toContain("TRUST THIS REPOSITORY?");
    expect(view.lastFrame()).toContain("/tmp/repo");
    expect(view.lastFrame()).toContain("openai");
    expect(view.lastFrame()).not.toContain("Loading home data");
    expect(view.lastFrame()).not.toContain("Home Data Unavailable");
    expect(view.lastFrame()).not.toContain("Not configured");
  });
});

function TestNavigationProvider({ children }: { children: ReactNode }) {
  return createElement(NavigationProvider, { initialRoute: { screen: "home" }, children });
}

function useGuardAndRoute() {
  const state = useConfigGuard();
  const { route } = useNavigation();
  return { state, route };
}
