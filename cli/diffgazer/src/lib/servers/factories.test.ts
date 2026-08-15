import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

const execaMock = vi.hoisted(() => vi.fn());
// Boundary mock: subprocess launcher for the dev API and Vite children.
vi.mock("execa", () => ({ execa: execaMock }));

import { config } from "../../config";
import { createFakeChild } from "../../testing/server-process-fixtures";
import { createServerFactories } from "./factories";
import type { ServerController } from "./types";

const createApiServer = vi.fn(() => createTestServer());
const createWebServer = vi.fn(() => createTestServer());
const createEmbeddedServer = vi.fn(() => createTestServer());
const readyHandler = vi.fn();
const originalPort = process.env.PORT;
const originalViteApiUrl = process.env.VITE_API_URL;

function restoreEnv(name: "PORT" | "VITE_API_URL", value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

function createTestServer(): ServerController {
  return {
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
  };
}

function createFactories(options: Parameters<typeof createServerFactories>[0]) {
  return createServerFactories(options, {
    createApiServer,
    createEmbeddedServer,
    createReadyHandler: () => readyHandler,
    createWebServer,
    findGitRoot: () => "/repo",
    getCwd: () => "/repo/subdir",
  });
}

describe("createServerFactories", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    restoreEnv("PORT", originalPort);
    restoreEnv("VITE_API_URL", originalViteApiUrl);
    vi.clearAllMocks();
  });

  it("uses the default API port for both dev children", () => {
    delete process.env.PORT;
    delete process.env.VITE_API_URL;

    const factories = createFactories({ mode: "dev", openBrowser: false });
    factories[0]?.();
    factories[1]?.();

    expect(createApiServer).toHaveBeenCalledWith(
      expect.objectContaining({ port: config.ports.api }),
    );
    expect(createWebServer).toHaveBeenCalledWith(
      expect.objectContaining({ apiUrl: `http://127.0.0.1:${config.ports.api}` }),
    );
  });

  it("passes a custom PORT to the API child and derives the Vite API target", () => {
    vi.stubEnv("PORT", "4321");
    delete process.env.VITE_API_URL;

    const factories = createFactories({ mode: "dev", openBrowser: false });
    factories[0]?.();
    factories[1]?.();

    expect(createApiServer).toHaveBeenCalledWith(
      expect.objectContaining({ port: 4321, cwd: config.paths.server, projectRoot: "/repo" }),
    );
    expect(createWebServer).toHaveBeenCalledWith(
      expect.objectContaining({ apiUrl: "http://127.0.0.1:4321" }),
    );
  });

  it("passes the API target derived from PORT into the actual Vite child environment", () => {
    vi.stubEnv("PORT", "4321");
    delete process.env.VITE_API_URL;
    execaMock.mockReturnValue(createFakeChild());

    const factories = createServerFactories(
      { mode: "dev", openBrowser: false },
      {
        createApiServer,
        createEmbeddedServer,
        createReadyHandler: () => readyHandler,
        findGitRoot: () => "/repo",
        getCwd: () => "/repo/subdir",
      },
    );
    void factories[1]?.().start();

    expect(execaMock).toHaveBeenCalledWith(
      "pnpm",
      expect.arrayContaining(["exec", "vite"]),
      expect.objectContaining({
        env: expect.objectContaining({ VITE_API_URL: "http://127.0.0.1:4321" }),
      }),
    );
  });

  it("preserves an explicit VITE_API_URL override for the Vite child", () => {
    vi.stubEnv("PORT", "4321");
    vi.stubEnv("VITE_API_URL", "http://localhost:9876");

    const factories = createFactories({ mode: "dev", openBrowser: false });
    factories[0]?.();
    factories[1]?.();

    expect(createApiServer).toHaveBeenCalledWith(expect.objectContaining({ port: 4321 }));
    expect(createWebServer).toHaveBeenCalledWith(
      expect.objectContaining({ apiUrl: "http://localhost:9876" }),
    );
  });

  it("falls back to the PORT-derived target when VITE_API_URL is blank", () => {
    vi.stubEnv("PORT", "4500");
    vi.stubEnv("VITE_API_URL", "   ");

    const factories = createFactories({ mode: "dev", openBrowser: false });
    factories[0]?.();
    factories[1]?.();

    expect(createApiServer).toHaveBeenCalledWith(expect.objectContaining({ port: 4500 }));
    expect(createWebServer).toHaveBeenCalledWith(
      expect.objectContaining({ apiUrl: "http://127.0.0.1:4500" }),
    );
  });

  it("does not create a Vite child for dev TUI when includeWebServer is false", () => {
    const factories = createFactories({
      mode: "dev",
      openBrowser: false,
      includeWebServer: false,
    });

    expect(factories).toHaveLength(1);
    factories[0]?.();
    expect(createApiServer).toHaveBeenCalled();
    expect(createWebServer).not.toHaveBeenCalled();
  });

  it("creates API and Vite children for dev web mode by default", () => {
    const factories = createFactories({ mode: "dev", openBrowser: true });

    expect(factories).toHaveLength(2);
    factories[0]?.();
    factories[1]?.();
    expect(createApiServer).toHaveBeenCalled();
    expect(createWebServer).toHaveBeenCalled();
  });

  it("wires both dev child failures to the coordinated startup failure handler", () => {
    const onStartupFailure = vi.fn();
    const factories = createFactories({
      mode: "dev",
      openBrowser: false,
      onStartupFailure,
    });

    factories[0]?.();
    factories[1]?.();

    expect(createApiServer).toHaveBeenCalledWith(
      expect.objectContaining({ onFailure: onStartupFailure }),
    );
    expect(createWebServer).toHaveBeenCalledWith(
      expect.objectContaining({ onFailure: onStartupFailure }),
    );
  });

  it("forwards an actual dev API process failure through the factory callback", async () => {
    const onStartupFailure = vi.fn();
    let rejectChild: ((error: Error) => void) | undefined;
    const child = Object.assign(
      new Promise<unknown>((_resolve, reject) => {
        rejectChild = reject;
      }),
      {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        kill: vi.fn(),
        pid: 4321,
      },
    );
    execaMock.mockReturnValue(child);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const factories = createServerFactories(
      {
        mode: "dev",
        openBrowser: false,
        includeWebServer: false,
        onStartupFailure,
      },
      {
        createEmbeddedServer,
        createReadyHandler: () => readyHandler,
        createWebServer,
        findGitRoot: () => "/repo",
        getCwd: () => "/repo/subdir",
      },
    );

    const starting = factories[0]?.().start();
    void starting?.catch(() => undefined);
    child.stderr.emit("data", Buffer.from("Error: listen EADDRINUSE 127.0.0.1:3000\n"));
    rejectChild?.(Object.assign(new Error("Process exited"), { exitCode: 1, killed: false }));

    await expect(starting).rejects.toThrow();
    await vi.waitFor(() => expect(onStartupFailure).toHaveBeenCalledOnce());
    expect(onStartupFailure.mock.calls[0]?.[0]).toContain("EADDRINUSE");
  });

  it("announces the ready URL for the packaged web launcher", () => {
    const factories = createFactories({ mode: "prod", openBrowser: true });
    factories[0]?.();

    expect(createEmbeddedServer).toHaveBeenCalledWith(
      expect.objectContaining({ onReady: readyHandler }),
    );
  });

  it("stays silent on ready for the packaged TUI, which owns the screen", () => {
    const factories = createFactories({
      mode: "prod",
      openBrowser: false,
      includeWebServer: false,
      announceReady: false,
    });
    factories[0]?.();

    expect(createEmbeddedServer).toHaveBeenCalledWith(
      expect.objectContaining({ onReady: undefined }),
    );
  });

  it("wires embedded startup failures to onStartupFailure in prod mode", () => {
    const onStartupFailure = vi.fn();

    const factories = createFactories({
      mode: "prod",
      openBrowser: false,
      onStartupFailure,
    });
    factories[0]?.();

    expect(createEmbeddedServer).toHaveBeenCalledWith(
      expect.objectContaining({ onFailure: onStartupFailure }),
    );
  });
});
