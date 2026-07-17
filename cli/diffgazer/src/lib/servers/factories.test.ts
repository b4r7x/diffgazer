import { afterEach, describe, expect, it, vi } from "vitest";
import { config } from "../../config";
import { createServerFactories } from "./factories";
import type { ProcessServerConfig, ServerController } from "./process";

const createProcessServerMock = vi.hoisted(() =>
  vi.fn((_config: ProcessServerConfig) => ({
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
  })),
);

vi.mock("./process", () => ({ createProcessServer: createProcessServerMock }));

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
    factories[1]?.();

    expect(createProcessServerMock).toHaveBeenCalledWith(
      expect.objectContaining({ env: { VITE_API_URL: "http://127.0.0.1:4321" } }),
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

  it("passes the canonical git root into the dev API child", () => {
    const factories = createFactories({ mode: "dev", openBrowser: false });
    factories[0]?.();

    expect(createApiServer).toHaveBeenCalledWith(expect.objectContaining({ projectRoot: "/repo" }));
  });

  it.each([
    "/repo/zażółć",
    "/repo/🚀",
  ])("passes a non-ASCII git root through the server environment for %s", (projectRoot) => {
    const factories = createServerFactories(
      { mode: "dev", openBrowser: false, includeWebServer: false },
      {
        createApiServer,
        createEmbeddedServer,
        createReadyHandler: () => readyHandler,
        createWebServer,
        findGitRoot: () => projectRoot,
        getCwd: () => `${projectRoot}/src`,
      },
    );

    factories[0]?.();

    expect(createApiServer).toHaveBeenCalledWith(expect.objectContaining({ projectRoot }));
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

  it("forwards an actual dev API process failure through the factory callback", () => {
    const onStartupFailure = vi.fn();
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

    factories[0]?.();
    const processConfig = createProcessServerMock.mock.calls[0]?.[0];
    expect(processConfig).toEqual(expect.objectContaining({ onFailure: expect.any(Function) }));

    processConfig?.onFailure?.("Port 3000 is already in use");
    expect(onStartupFailure).toHaveBeenCalledExactlyOnceWith("Port 3000 is already in use");
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
