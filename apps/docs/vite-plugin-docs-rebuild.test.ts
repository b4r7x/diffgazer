import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execMock = vi.hoisted(() => vi.fn());

// Boundary mock: subprocess execution for docs rebuild commands.
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, default: { ...actual, exec: execMock }, exec: execMock };
});

type WatchHandler = (event: string, filePath: string) => void;

function createStubServer() {
  const added: string[] = [];
  const handlers: WatchHandler[] = [];

  return {
    added,
    emit(event: string, filePath: string) {
      for (const handler of handlers) handler(event, filePath);
    },
    server: {
      config: { logger: { info: vi.fn(), error: vi.fn() } },
      ws: { send: vi.fn() },
      watcher: {
        add(dir: string) {
          added.push(dir);
        },
        on(_event: string, handler: WatchHandler) {
          handlers.push(handler);
        },
      },
    },
  };
}

describe("docsDataRebuild", () => {
  const originalVitest = process.env.VITEST;
  const originalDev = process.env.DIFFGAZER_DEV;

  beforeEach(() => {
    vi.useFakeTimers();
    execMock.mockReset();
    delete process.env.VITEST;
    process.env.DIFFGAZER_DEV = "1";
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalVitest === undefined) delete process.env.VITEST;
    else process.env.VITEST = originalVitest;
    if (originalDev === undefined) delete process.env.DIFFGAZER_DEV;
    else process.env.DIFFGAZER_DEV = originalDev;
  });

  it("runs the rebuild with artifact preparation skipped", async () => {
    const { docsDataRebuild } = await import("./vite-plugin-docs-rebuild");
    const stub = createStubServer();
    const plugin = docsDataRebuild();

    (plugin.configureServer as (s: typeof stub.server) => void)(stub.server);
    expect(stub.added.length).toBeGreaterThan(0);

    stub.emit("change", `${stub.added[0]}/manifest.json`);
    vi.advanceTimersByTime(300);

    expect(execMock).toHaveBeenCalledTimes(1);
    const [, options] = execMock.mock.calls[0];
    expect(options.env.DIFFGAZER_SKIP_ARTIFACT_PREPARE).toBe("1");
  });

  it("runs one pending rebuild for watcher events fired while a rebuild is in flight", async () => {
    const { docsDataRebuild } = await import("./vite-plugin-docs-rebuild");
    const stub = createStubServer();
    const plugin = docsDataRebuild();

    (plugin.configureServer as (s: typeof stub.server) => void)(stub.server);

    const watchedFile = `${stub.added[0]}/manifest.json`;
    stub.emit("change", watchedFile);
    vi.advanceTimersByTime(300);
    expect(execMock).toHaveBeenCalledTimes(1);

    // The exec callback has not fired yet, so the rebuild is still in flight.
    // The watcher guard records one pending rebuild instead of dropping it.
    stub.emit("change", watchedFile);
    vi.advanceTimersByTime(300);
    expect(execMock).toHaveBeenCalledTimes(1);

    // Completing the in-flight rebuild flushes the pending rebuild immediately.
    const [, , callback] = execMock.mock.calls[0];
    callback(null, "", "");
    expect(execMock).toHaveBeenCalledTimes(2);
  });
});
