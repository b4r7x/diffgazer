import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { createServerFactories } from "../lib/servers/factories";

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

import { App } from "./root";

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
