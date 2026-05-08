import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { setImmediate as waitImmediate } from "node:timers/promises";
import { getDiffgazerBanner } from "./banner.js";
import { HELP_TEXT, resolveCliAction } from "./cli-options.js";
import { parsePortEnv, openBrowserAddress } from "./lib/servers/server-factories.js";
import { startWeb } from "./web-launcher.js";

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

  test("rejects theme selection outside the TUI flow", () => {
    assert.throws(
      () => resolveCliAction(["--theme", "classic"]),
      /--theme requires --tui\./,
    );
  });

  test("describes TUI as incomplete beta in help", () => {
    assert.match(HELP_TEXT, /--tui/);
    assert.match(HELP_TEXT, /beta terminal UI \(incomplete; not recommended\)/);
    assert.match(HELP_TEXT, /--theme <theme>\s+Start TUI with a specific theme \(only with --tui\)/);
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
