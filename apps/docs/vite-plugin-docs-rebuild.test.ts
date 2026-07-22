import { resolve } from "node:path";
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
  const logger = { info: vi.fn(), error: vi.fn() };
  const wsSend = vi.fn();

  return {
    added,
    logger,
    wsSend,
    emit(event: string, filePath: string) {
      for (const handler of handlers) handler(event, filePath);
    },
    server: {
      config: { logger },
      ws: { send: wsSend },
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

function configurePlugin(
  configureServer: ReturnType<
    typeof import("./vite-plugin-docs-rebuild")["docsDataRebuild"]
  >["configureServer"],
  server: ReturnType<typeof createStubServer>["server"],
): void {
  if (typeof configureServer !== "function") {
    throw new Error("Expected a configureServer function hook");
  }
  Reflect.apply(configureServer, undefined, [server]);
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

  it("runs the rebuild against the exec boundary and reloads on success", async () => {
    const { docsDataRebuild } = await import("./vite-plugin-docs-rebuild");
    const stub = createStubServer();
    const plugin = docsDataRebuild();

    configurePlugin(plugin.configureServer, stub.server);
    expect(stub.added.length).toBeGreaterThan(0);

    stub.emit("change", `${stub.added[0]}/manifest.json`);
    vi.advanceTimersByTime(300);

    expect(execMock).toHaveBeenCalledTimes(1);
    const call = execMock.mock.calls[0];
    if (!call) throw new Error("Expected rebuild subprocess call");
    const [command, options, callback] = call;
    expect(command).toBe("pnpm prepare:generated");
    expect(options.cwd).toBe(resolve(import.meta.dirname));
    expect(options.env.DIFFGAZER_SKIP_ARTIFACT_PREPARE).toBe("1");

    callback(null, "", "");
    expect(stub.wsSend).toHaveBeenCalledTimes(1);
    expect(stub.wsSend).toHaveBeenCalledWith({ type: "full-reload" });
  });

  it("logs a build failure diagnostic and skips the reload when the rebuild subprocess errors", async () => {
    const { docsDataRebuild } = await import("./vite-plugin-docs-rebuild");
    const stub = createStubServer();
    const plugin = docsDataRebuild();

    configurePlugin(plugin.configureServer, stub.server);

    stub.emit("change", `${stub.added[0]}/manifest.json`);
    vi.advanceTimersByTime(300);

    const call = execMock.mock.calls[0];
    if (!call) throw new Error("Expected rebuild subprocess call");
    const [, , callback] = call;
    callback(new Error("boom"), "", "prepare:generated failed");

    expect(stub.logger.error).toHaveBeenCalledWith(
      "[docs-data] Build failed: prepare:generated failed",
    );
    expect(stub.wsSend).not.toHaveBeenCalled();
  });

  it("runs one pending rebuild for watcher events fired while a rebuild is in flight", async () => {
    const { docsDataRebuild } = await import("./vite-plugin-docs-rebuild");
    const stub = createStubServer();
    const plugin = docsDataRebuild();

    configurePlugin(plugin.configureServer, stub.server);

    const watchedFile = `${stub.added[0]}/manifest.json`;
    stub.emit("change", watchedFile);
    vi.advanceTimersByTime(300);
    expect(execMock).toHaveBeenCalledTimes(1);

    stub.emit("change", watchedFile);
    vi.advanceTimersByTime(300);
    expect(execMock).toHaveBeenCalledTimes(1);

    const call = execMock.mock.calls[0];
    if (!call) throw new Error("Expected rebuild subprocess call");
    const [, , callback] = call;
    callback(null, "", "");
    expect(execMock).toHaveBeenCalledTimes(2);
  });
});
