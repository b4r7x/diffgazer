import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

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
const retryMock = vi.hoisted(() => vi.fn(() => Promise.resolve(undefined)));
const refetchConfigMock = vi.hoisted(() => vi.fn(() => Promise.resolve(undefined)));
const startMock = vi.hoisted(() => vi.fn());
const stopMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const factory = vi.hoisted(() => ({
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
  createServerFactories: (options: { onStartupFailure?: (message: string) => void }) => {
    factory.onStartupFailure = options.onStartupFailure;
    return [() => ({ start: startMock, stop: stopMock })];
  },
}));

import { App } from "./root";

afterEach(() => {
  cleanup();
  serverStatusState.current = { status: "error", message: "fetch failed" };
  configCheckState.current = { data: undefined, error: null, isLoading: true };
  factory.onStartupFailure = undefined;
  vi.clearAllMocks();
});

describe("HealthGate startup-failure recovery", () => {
  it("re-invokes start() and retries health when r is pressed after a server error", async () => {
    const { stdin, lastFrame } = render(<App mode="prod" openBrowser={false} />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Press r to retry");
    });

    // The controller starts once on mount; pressing r must re-invoke start().
    const startsBefore = startMock.mock.calls.length;
    stdin.write("r");

    await vi.waitFor(() => {
      expect(startMock.mock.calls.length).toBeGreaterThan(startsBefore);
      expect(retryMock).toHaveBeenCalled();
    });
  });

  it("surfaces the real bind error when the embedded server fails to start", async () => {
    const { lastFrame, rerender } = render(<App mode="prod" openBrowser={false} />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Server Disconnected");
    });

    factory.onStartupFailure?.(
      "Port 3000 is already in use. Close the other process or set a different PORT.",
    );
    rerender(<App mode="prod" openBrowser={false} />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Server Failed to Start");
      expect(lastFrame()).toContain("Port 3000 is already in use");
    });
    expect(lastFrame()).not.toContain("Server Disconnected");
  });

  it("transitions past the health gate once the server reports connected", async () => {
    serverStatusState.current = { status: "connected" };

    const { lastFrame } = render(<App mode="prod" openBrowser={false} />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Checking configuration");
    });
    expect(lastFrame()).not.toContain("Press r to retry");
  });
});
