import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test, { describe } from "node:test";
import { setImmediate as waitImmediate } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { getDiffgazerBanner } from "./banner.js";
import { resolveCliAction } from "./cli-options.js";
import { parsePortEnv, openBrowserAddress } from "./lib/servers/server-factories.js";
import { startWeb } from "./web-launcher.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const cliEntry = resolve(repoRoot, "cli/diffgazer/src/index.tsx");
const packageJson = resolve(repoRoot, "cli/diffgazer/package.json");

function runDiffgazer(args: string[]): string {
  return execFileSync(process.execPath, ["--import", "tsx", cliEntry, ...args], {
    cwd: repoRoot,
    encoding: "utf-8",
  });
}

describe("resolveCliAction", () => {
  test("starts the web flow by default and opens the browser", () => {
    assert.deepEqual(resolveCliAction([]), {
      type: "web",
      mode: "prod",
      openBrowser: true,
    });
  });

  test("starts beta TUI only when requested and keeps browser closed", () => {
    const action = resolveCliAction(["--tui"]);

    assert.equal(action.type, "tui");
    assert.equal(action.mode, "prod");
    assert.equal(action.openBrowser, false);
  });

  test("keeps dev mode and theme for the TUI flow", () => {
    const action = resolveCliAction(["--dev", "--tui", "--theme", "classic"]);

    assert.deepEqual(action, {
      type: "tui",
      mode: "dev",
      theme: "classic",
      openBrowser: false,
    });
  });

});

describe("diffgazer CLI options", () => {
  test("prints help without starting servers", () => {
    const output = runDiffgazer(["--help"]);

    assert.match(output, /Usage: diffgazer \[options\]/);
    assert.match(output, /--tui\s+Start the beta terminal UI \(incomplete; not recommended\)/);
    assert.match(output, /--theme <theme>\s+Start TUI with a specific theme \(only with --tui\)/);
  });

  test("prints package version", () => {
    const metadata = JSON.parse(readFileSync(packageJson, "utf-8")) as { version: string };

    assert.equal(runDiffgazer(["--version"]).trim(), metadata.version);
  });

  test("exits with an error for invalid options", () => {
    const result = spawnSync(process.execPath, ["--import", "tsx", cliEntry, "--theme", "classic"], {
      cwd: repoRoot,
      encoding: "utf-8",
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /--theme requires --tui\./);
  });
});

describe("getDiffgazerBanner", () => {
  test("returns printable ASCII banner text", () => {
    const banner = getDiffgazerBanner();

    assert.ok(banner.trim().length >= "DIFFGAZER".length);
    assert.ok(banner.includes("\n") || banner === "DIFFGAZER");
  });
});

describe("server launcher options", () => {
  test("parses PORT only when it is a valid TCP port", () => {
    assert.equal(parsePortEnv(undefined, 3000), 3000);
    assert.equal(parsePortEnv(" 4567 ", 3000), 4567);

    for (const value of ["", "0", "65536", "3.14", "abc"]) {
      assert.throws(
        () => parsePortEnv(value, 3000),
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

    assert.deepEqual(warnings, [
      "Could not open browser at http://localhost:3000: launcher unavailable",
    ]);
  });

  test("prints the banner before starting web servers and stops them on cleanup", () => {
    const events: string[] = [];

    const stop = startWeb(
      { mode: "prod", openBrowser: false },
      {
        printBanner: () => events.push("banner"),
        createServerFactories: () => [
          () => ({
            start: () => events.push("start"),
            stop: () => events.push("stop"),
          }),
        ],
      },
    );

    assert.deepEqual(events, ["banner", "start"]);
    stop();
    stop();

    assert.deepEqual(events, ["banner", "start", "stop"]);
  });
});
