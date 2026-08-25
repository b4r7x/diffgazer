import { makeReadyInitResponse } from "@diffgazer/core/testing/provider-fixtures";
import { cleanup, render } from "ink-testing-library";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { createServerFactories } from "../lib/servers/factories";
import { App } from "./root";

type ServerFactoryOptions = Parameters<typeof createServerFactories>[0];

type FakeServerState =
  | { status: "checking" }
  | { status: "connected" }
  | { status: "error"; message: string };

const serverStatusState = vi.hoisted(() => ({
  current: { status: "error", message: "fetch failed" } as FakeServerState,
  latest: { status: "error", message: "fetch failed" } as FakeServerState,
}));
const initQueryState = vi.hoisted(() => ({
  current: {
    data: undefined as
      | ReturnType<typeof import("@diffgazer/core/testing/provider-fixtures").makeReadyInitResponse>
      | undefined,
    error: null as Error | null,
    isLoading: true,
  },
}));
const dims = vi.hoisted(() => ({ current: { columns: 100, rows: 30 } }));
const retryMock = vi.hoisted(() => vi.fn<() => Promise<unknown>>(() => Promise.resolve(undefined)));
const refetchInitMock = vi.hoisted(() => vi.fn(() => Promise.resolve(undefined)));
const startMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const stopMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const factory = vi.hoisted(() => ({
  options: undefined as ServerFactoryOptions | undefined,
  onStartupFailure: undefined as ((message: string) => void) | undefined,
}));

vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@diffgazer/core/api/hooks")>();
  return {
    ...actual,
    useConfigurationInit: () => ({ ...initQueryState.current, refetch: refetchInitMock }),
    useServerStatus: () => ({
      state: serverStatusState.current,
      latestState: serverStatusState.latest,
      retry: retryMock,
    }),
    useReviews: () => ({ data: { reviews: [] } }),
    useActiveReviewSession: () => ({ data: { session: null } }),
    useSaveTrust: () => ({ error: null, isPending: false, mutate: () => {} }),
    useShutdown: () => ({ mutate: () => {} }),
  };
});

vi.mock("../lib/servers/factories", () => ({
  createServerFactories: (options: ServerFactoryOptions) => {
    factory.options = options;
    factory.onStartupFailure = options.onStartupFailure;
    return [() => ({ start: startMock, stop: stopMock })];
  },
}));

vi.mock("../hooks/use-terminal-dimensions", () => ({
  useResponsive: () => ({
    ...dims.current,
    isNarrow: dims.current.columns < 80,
    isWide: dims.current.columns >= 120,
  }),
  useTerminalDimensions: () => ({ ...dims.current }),
}));
vi.mock("../hooks/use-exit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hooks/use-exit")>();
  return { ...actual, useExit: () => ({ handleExit: () => {} }) };
});
vi.mock("@diffgazer/core/footer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@diffgazer/core/footer")>();
  return { ...actual, usePageFooter: () => {} };
});
vi.mock("./providers/server", () => ({
  ServerProvider: ({ children }: { children: ReactNode }) => children,
  useServerControls: () => ({ restartServers: () => Promise.resolve() }),
}));

afterEach(() => {
  cleanup();
  serverStatusState.current = { status: "error", message: "fetch failed" };
  serverStatusState.latest = { status: "error", message: "fetch failed" };
  initQueryState.current = { data: undefined, error: null, isLoading: true };
  dims.current = { columns: 100, rows: 30 };
  vi.clearAllMocks();
});

function frameLines(frame: string | undefined): string[] {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: strips terminal color codes for layout math
  return (frame ?? "").replace(/\u001b\[[0-9;]*m/g, "").split("\n");
}

async function renderConfigErrorGate() {
  serverStatusState.current = { status: "connected" };
  serverStatusState.latest = { status: "connected" };
  initQueryState.current = {
    data: undefined,
    error: new Error("Load failed. Is the server running?"),
    isLoading: false,
  };

  const view = render(<App mode="prod" />);
  await vi.waitFor(() => {
    expect(view.lastFrame()).toContain("Configuration Unavailable");
  });
  return view;
}

describe("ConfigGate app integration", () => {
  it("loads configuration init for the config gate before onboarding redirect", async () => {
    initQueryState.current = {
      data: {
        schemaVersion: 2,
        configurations: [],
        unrecognizedConfigurations: [],
        selectedConfigurationId: null,
        settings: {
          theme: "auto",
          defaultLenses: [],
          effectiveCallTokenCap: 49_152,
          defaultProfile: null,
          severityThreshold: "low",
          secretsStorage: null,
          agentExecution: "sequential",
          providerConsent: null,
        },
        project: { path: "/repo", projectId: null, trust: null },
      },
      error: null,
      isLoading: false,
    };
    serverStatusState.current = { status: "connected" };
    serverStatusState.latest = { status: "connected" };

    render(<App mode="prod" />);

    await vi.waitFor(() => expect(initQueryState.current.data).not.toBeUndefined());
  });
});

describe("ConfigGate error gate", () => {
  it("renders the failure as a panel with the wordmark, message, retry button and footer hints", async () => {
    const { lastFrame } = await renderConfigErrorGate();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("diffgazer");
    expect(frame).toContain("✖ Configuration Unavailable");
    expect(frame).toContain("Load failed. Is the server running?");
    expect(frame).toContain("[ Retry ]");
    expect(frame).toContain("[Enter] Retry");
    // The provider status chip belongs to the in-app header, not the gate.
    expect(frame).not.toContain("Not configured");
    // Nothing to go back to from the initial route, so no back affordance.
    expect(frame).not.toContain("[Esc] Back");
  });

  it.each([
    { columns: 100, rows: 30 },
    { columns: 80, rows: 20 },
  ])("centers the gate panel between wordmark and footer at $columns x $rows", async (size) => {
    dims.current = size;
    const { lastFrame } = await renderConfigErrorGate();

    const lines = frameLines(lastFrame());
    const contentTop = lines.findIndex((line) => line.includes("- * - + -")) + 1;
    const footerRow = lines.length - 1;
    const panelTop = lines.findIndex((line) => line.includes("┌"));
    const panelBottom = lines.findIndex((line) => line.includes("└"));

    expect(lines[footerRow]).toContain("[Enter] Retry");
    expect(contentTop).toBeGreaterThan(0);
    expect(panelTop).toBeGreaterThan(contentTop);

    const rowsAbovePanel = panelTop - contentTop;
    const rowsBelowPanel = footerRow - 1 - panelBottom;
    expect(rowsAbovePanel).toBeGreaterThanOrEqual(2);
    expect(rowsBelowPanel).toBeGreaterThanOrEqual(2);
    expect(Math.abs(rowsAbovePanel - rowsBelowPanel)).toBeLessThanOrEqual(2);
  });

  it.each([
    { label: "Enter", input: "\r" },
    { label: "Space", input: " " },
    { label: "r", input: "r" },
  ])("retries the configuration load on $label", async ({ input }) => {
    const { stdin } = await renderConfigErrorGate();

    stdin.write(input);

    await vi.waitFor(() => expect(refetchInitMock).toHaveBeenCalledOnce());
  });

  it("reads a credential-caused init failure as the warning reconnect gate with retry intact", async () => {
    serverStatusState.current = { status: "connected" };
    serverStatusState.latest = { status: "connected" };
    initQueryState.current = {
      data: undefined,
      error: Object.assign(new Error("keyring read failed"), {
        status: 500,
        code: "KEYRING_READ_FAILED",
      }),
      isLoading: false,
    };

    const { lastFrame, stdin } = render(<App mode="prod" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("⚠ Reconnect Provider");
    });

    const frame = lastFrame() ?? "";
    expect(frame).not.toContain("✖");
    expect(frame).not.toContain("Configuration Unavailable");
    expect(frame).toContain("The saved provider credential could not be read.");
    expect(frame).toContain("[ Retry ]");

    stdin.write("r");
    await vi.waitFor(() => expect(refetchInitMock).toHaveBeenCalledOnce());
  });

  it("keeps Esc-back working while the gate covers a sub-screen", async () => {
    serverStatusState.current = { status: "connected" };
    serverStatusState.latest = { status: "connected" };
    initQueryState.current = { data: makeReadyInitResponse(), error: null, isLoading: false };

    const { lastFrame, stdin, rerender } = render(<App mode="prod" />);
    await vi.waitFor(() => expect(lastFrame()).not.toContain("Checking configuration"));

    stdin.write("?");
    await vi.waitFor(() => expect(lastFrame()).toContain("← Back"));

    initQueryState.current = {
      data: undefined,
      error: new Error("Load failed. Is the server running?"),
      isLoading: false,
    };
    rerender(<App mode="prod" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Configuration Unavailable");
      expect(lastFrame()).toContain("[Esc] Back");
    });

    stdin.write("\u001B");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Configuration Unavailable");
      expect(lastFrame()).not.toContain("[Esc] Back");
    });
  });
});
