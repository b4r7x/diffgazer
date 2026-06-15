import { afterEach, describe, expect, it, vi } from "vitest";
import { config } from "../../config";
import { createServerFactories } from "./factories";
import type { ServerController } from "./process";

const createApiServer = vi.fn(() => createTestServer());
const createWebServer = vi.fn(() => createTestServer());
const createEmbeddedServer = vi.fn(() => createTestServer());
const readyHandler = vi.fn();

function createTestServer(): ServerController {
  return {
    start: vi.fn(),
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
    vi.clearAllMocks();
  });

  it("passes the configured API port from PORT into the dev API child", () => {
    vi.stubEnv("PORT", "4321");

    const factories = createFactories({ mode: "dev", openBrowser: false });
    factories[0]?.();

    expect(createApiServer).toHaveBeenCalledWith(
      expect.objectContaining({ port: 4321, cwd: config.paths.server, projectRoot: "/repo" }),
    );
  });

  it("passes the canonical git root into the dev API child", () => {
    const factories = createFactories({ mode: "dev", openBrowser: false });
    factories[0]?.();

    expect(createApiServer).toHaveBeenCalledWith(expect.objectContaining({ projectRoot: "/repo" }));
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
