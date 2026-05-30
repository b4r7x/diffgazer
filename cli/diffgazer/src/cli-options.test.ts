import { execFileSync, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { setImmediate as waitImmediate } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { test, describe, expect } from "vitest";
import { parsePortEnv } from "@diffgazer/core/env";
import { resolveCliAction } from "./cli-options";
import { openBrowserAddress } from "./lib/servers/server-factories";
import { isSpaNavigationRequest } from "./lib/servers/embedded-server";
import { ensureShutdownToken } from "./lib/shutdown-token";
import { startWeb } from "./web-launcher";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const cliEntry = resolve(repoRoot, "cli/diffgazer/src/index.tsx");

function runDiffgazer(args: string[]): string {
  return execFileSync(process.execPath, ["--import", "tsx", cliEntry, ...args], {
    cwd: repoRoot,
    encoding: "utf-8",
  });
}

function requestContext(pathname: string, options: { method?: string; accept?: string } = {}) {
  return {
    req: {
      method: options.method ?? "GET",
      url: `http://localhost:3000${pathname}`,
      header: (name: string) =>
        name.toLowerCase() === "accept" ? options.accept ?? "text/html" : undefined,
    },
  } as Parameters<typeof isSpaNavigationRequest>[0];
}

describe("resolveCliAction", () => {
  test("starts the web flow by default and opens the browser", () => {
    expect(resolveCliAction([])).toEqual({
      type: "web",
      mode: "prod",
      openBrowser: true,
    });
  });

  test("starts beta TUI only when requested and keeps browser closed", () => {
    const action = resolveCliAction(["--tui"]);

    if (action.type !== "tui") {
      expect.fail(`expected tui action, got ${action.type}`);
    }
    expect(action.mode).toBe("prod");
    expect(action.openBrowser).toBe(false);
  });

  test("keeps dev mode and theme for the TUI flow", () => {
    const action = resolveCliAction(["--dev", "--tui", "--theme", "classic"]);

    expect(action).toEqual({
      type: "tui",
      mode: "dev",
      theme: "classic",
      openBrowser: false,
    });
  });

  test("returns help action when --help is passed", () => {
    expect(resolveCliAction(["--help"])).toEqual({ type: "help" });
    expect(resolveCliAction(["-h"])).toEqual({ type: "help" });
  });

  test("returns version action when --version is passed", () => {
    expect(resolveCliAction(["--version"])).toEqual({ type: "version" });
    expect(resolveCliAction(["-V"])).toEqual({ type: "version" });
  });

  test("rejects --theme without --tui", () => {
    expect(() => resolveCliAction(["--theme", "classic"])).toThrow(
      /--theme requires --tui\./,
    );
  });

});

describe("diffgazer CLI options", () => {
  test("prints help without starting servers", () => {
    const output = runDiffgazer(["--help"]);

    expect(output).toMatch(/Usage: diffgazer \[options\]/);
    expect(output).toMatch(/--tui\s+Start the beta terminal UI \(incomplete; not recommended\)/);
    expect(output).toMatch(/--theme <theme>\s+Start TUI with a specific theme \(only with --tui\)/);
  });

  test("prints a version without reading package.json at runtime", () => {
    // The published binary injects package.json's version at build time (tsup
    // `define`). Run from source via tsx the define is absent, so the CLI must
    // fall back to the documented dev placeholder instead of crashing on a
    // missing/renamed package.json.
    expect(runDiffgazer(["--version"]).trim()).toBe("0.0.0-dev");
  });

  test("exits with an error for invalid options", () => {
    const result = spawnSync(process.execPath, ["--import", "tsx", cliEntry, "--theme", "classic"], {
      cwd: repoRoot,
      encoding: "utf-8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/--theme requires --tui\./);
  });
});

describe("server launcher options", () => {
  test("parses PORT only when it is a valid TCP port", () => {
    expect(parsePortEnv(undefined, 3000)).toBe(3000);
    expect(parsePortEnv(" 4567 ", 3000)).toBe(4567);

    for (const value of ["", "0", "65536", "3.14", "abc"]) {
      expect(() => parsePortEnv(value, 3000)).toThrow(
        /Invalid PORT ".*": expected an integer from 1 to 65535\./,
      );
    }
  });

  test("warns when opening the browser fails", async () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;

    console.warn = (message?: unknown) => {
      warnings.push(String(message));
    };

    try {
      openBrowserAddress("http://localhost:3000", () =>
        Promise.reject(new Error("launcher unavailable")),
      );
      await waitImmediate();
    } finally {
      console.warn = originalWarn;
    }

    expect(warnings).toEqual([
      "Could not open browser at http://localhost:3000: launcher unavailable",
    ]);
  });

  test("creates a per-process shutdown token and exposes it to web runtime env", () => {
    const originalShutdownToken = process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    const originalViteToken = process.env.VITE_DIFFGAZER_SHUTDOWN_TOKEN;
    process.env.DIFFGAZER_SHUTDOWN_TOKEN = "shell-token";
    delete process.env.VITE_DIFFGAZER_SHUTDOWN_TOKEN;

    try {
      const token = ensureShutdownToken();

      expect(token).toMatch(/^[a-f0-9]{64}$/);
      expect(token).not.toBe("shell-token");
      expect(process.env.DIFFGAZER_SHUTDOWN_TOKEN).toBe(token);
      expect(process.env.VITE_DIFFGAZER_SHUTDOWN_TOKEN).toBe(token);
      expect(ensureShutdownToken()).toBe(token);
    } finally {
      if (originalShutdownToken === undefined) {
        delete process.env.DIFFGAZER_SHUTDOWN_TOKEN;
      } else {
        process.env.DIFFGAZER_SHUTDOWN_TOKEN = originalShutdownToken;
      }
      if (originalViteToken === undefined) {
        delete process.env.VITE_DIFFGAZER_SHUTDOWN_TOKEN;
      } else {
        process.env.VITE_DIFFGAZER_SHUTDOWN_TOKEN = originalViteToken;
      }
    }
  });

  test("prints the banner before starting web servers and stops them on cleanup", async () => {
    const events: string[] = [];

    const stop = startWeb(
      { mode: "prod", openBrowser: false },
      {
        printBanner: () => events.push("banner"),
        createServerFactories: () => [
          () => ({
            start: () => events.push("start"),
            stop: () => {
              events.push("stop");
              return Promise.resolve();
            },
          }),
        ],
      },
    );

    expect(events).toEqual(["banner", "start"]);
    await stop();
    await stop();

    expect(events).toEqual(["banner", "start", "stop"]);
  });

  test("treats index.html as an injected SPA shell request", () => {
    expect(isSpaNavigationRequest(requestContext("/"), "/")).toBe(true);
    expect(isSpaNavigationRequest(requestContext("/settings"), "/settings")).toBe(true);
    expect(isSpaNavigationRequest(requestContext("/index.html"), "/index.html")).toBe(true);
    expect(isSpaNavigationRequest(requestContext("/assets/app.js"), "/assets/app.js")).toBe(false);
    expect(isSpaNavigationRequest(requestContext("/api/shutdown"), "/api/shutdown")).toBe(false);
    expect(
      isSpaNavigationRequest(requestContext("/index.html", { accept: "application/json" }), "/index.html"),
    ).toBe(false);
  });
});
