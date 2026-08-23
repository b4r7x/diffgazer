import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn as spawnPty } from "node-pty";
import stripAnsi from "strip-ansi";
import { escapeRegExp } from "../lib/regexp.mjs";
import { CommandFailedError, runArgv } from "../smoke-shared/command.mjs";

const TUI_BOOT_TIMEOUT_MS = 30_000;
const TUI_EXIT_TIMEOUT_MS = 10_000;
const WEB_BOOT_TIMEOUT_MS = 30_000;
const WEB_EXIT_TIMEOUT_MS = 10_000;
const SUPPORTS_PROCESS_GROUPS = process.platform !== "win32";

// Both registry namespaces in one pattern: bare-word `ui`/`keys` alternation
// branches matched unrelated help text (`--keys-version`), so the namespace
// assertion held even with the namespace itself removed.
export const INSTALLER_NAMESPACES = /ui\/\*[\s\S]*keys\/\*/;

// Main menu (configured), size gate, or first-run onboarding product step.
const TUI_INTERACTIVE_SHELL =
  /(?:Main Menu|Terminal too small|SELECT PRODUCT|Step \d+ of \d+: Product)/;
// "Configuration Unavailable" is CONFIGURATION_ERROR_COPY.title from libs/core,
// which both shells render for a failed configuration load.
const TUI_BOOT_FAILURE = /(?:Server Failed to Start|Server Disconnected|Configuration Unavailable)/;

async function runFailureArgv(root, command, args, cwd = root) {
  try {
    const output = await runArgv(command, args, cwd);
    throw new Error(
      `Expected command to fail but it succeeded: ${command} ${args.join(" ")}\n${output.slice(0, 250)}`,
    );
  } catch (err) {
    if (!(err instanceof CommandFailedError)) {
      throw err;
    }

    return err.output;
  }
}

function failTuiBoot(rejectPromise, terminal, bootTimer, exitTimer, message, output) {
  clearTimeout(bootTimer);
  clearTimeout(exitTimer);
  terminal.kill();
  rejectPromise(new Error(`${message}:\n${stripAnsi(output).slice(-1_000)}`));
}

// Both documented TUI exit inputs, each booted from a fresh fixture home.
const TUI_EXIT_INPUTS = [
  { label: "q", input: "q" },
  { label: "Ctrl+C", input: "\u0003" },
];

// The fixture home is not enough isolation: on the default API port the TUI reaches whatever
// already owns it (a developer's `pnpm run dev` server answers /api/health, then 401s the TUI's
// own token), so the smoke would report on someone else's process. Own band, disjoint from
// runWebBootSmoke's 31_000 band.
const TUI_SMOKE_PORT = 32_000 + (process.pid % 1_000);

async function runTuiBootSmoke(root, diffgazerBin, exitInput) {
  const fixtureHome = mkdtempSync(join(tmpdir(), "diffgazer-smoke-home-"));
  let output = "";

  try {
    await new Promise((resolvePromise, rejectPromise) => {
      let sawBootFrame = false;
      let exitTimer;
      const terminal = spawnPty(process.execPath, [diffgazerBin, "--tui"], {
        name: "xterm-256color",
        cols: 80,
        rows: 24,
        cwd: root,
        env: {
          ...process.env,
          DIFFGAZER_HOME: fixtureHome,
          PORT: String(TUI_SMOKE_PORT),
          NO_COLOR: "1",
          TERM: "xterm-256color",
        },
      });

      const bootTimer = setTimeout(() => {
        failTuiBoot(
          rejectPromise,
          terminal,
          bootTimer,
          exitTimer,
          `TUI did not reach an interactive shell within ${TUI_BOOT_TIMEOUT_MS}ms`,
          output,
        );
      }, TUI_BOOT_TIMEOUT_MS);

      terminal.onData((data) => {
        output = `${output}${data}`.slice(-64_000);
        const plain = stripAnsi(output);
        if (!sawBootFrame && TUI_BOOT_FAILURE.test(plain)) {
          failTuiBoot(
            rejectPromise,
            terminal,
            bootTimer,
            exitTimer,
            "TUI reported a startup or configuration failure",
            output,
          );
          return;
        }
        if (sawBootFrame || !TUI_INTERACTIVE_SHELL.test(plain)) return;

        sawBootFrame = true;
        clearTimeout(bootTimer);
        terminal.write(exitInput.input);
        exitTimer = setTimeout(() => {
          failTuiBoot(
            rejectPromise,
            terminal,
            bootTimer,
            exitTimer,
            `TUI did not exit after ${exitInput.label} within ${TUI_EXIT_TIMEOUT_MS}ms`,
            output,
          );
        }, TUI_EXIT_TIMEOUT_MS);
      });

      terminal.onExit(({ exitCode, signal }) => {
        clearTimeout(bootTimer);
        clearTimeout(exitTimer);
        if (!sawBootFrame) {
          rejectPromise(
            new Error(
              `TUI exited before reaching an interactive shell:\n${stripAnsi(output).slice(-1_000)}`,
            ),
          );
          return;
        }
        if (exitCode !== 0) {
          rejectPromise(new Error(`TUI exited with code ${exitCode} and signal ${signal}`));
          return;
        }
        resolvePromise();
      });
    });
  } finally {
    rmSync(fixtureHome, { recursive: true, force: true });
  }

  console.log(
    `OK: diffgazer --tui boots in an 80x24 pseudo-terminal and exits with ${exitInput.label}`,
  );
}

async function waitForWebReady(origin, isCancelled) {
  const deadline = Date.now() + WEB_BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    // The server is gone (the child already exited); stop polling a dead origin.
    if (isCancelled()) throw new Error(`diffgazer web mode stopped before ${origin} was ready`);
    try {
      const health = await fetch(`${origin}/api/health`);
      if (!health.ok) {
        await new Promise((resolveImmediate) => setTimeout(resolveImmediate, 200));
        continue;
      }
      const home = await fetch(origin);
      const contentType = home.headers.get("content-type") ?? "";
      if (home.ok && contentType.includes("text/html")) {
        return;
      }
    } catch {
      // Server still starting.
    }
    await new Promise((resolveImmediate) => setTimeout(resolveImmediate, 200));
  }
  throw new Error(
    `diffgazer web mode did not become ready at ${origin} within ${WEB_BOOT_TIMEOUT_MS}ms`,
  );
}

export async function runWebBootSmoke(root, diffgazerBin) {
  const port = 31_000 + (process.pid % 1_000);
  const origin = `http://127.0.0.1:${port}`;

  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [diffgazerBin], {
      cwd: root,
      env: {
        ...process.env,
        PORT: String(port),
        BROWSER: "none",
        NO_COLOR: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
      detached: SUPPORTS_PROCESS_GROUPS,
    });

    let stderr = "";
    let settled = false;
    let ready = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(bootTimer);
      clearTimeout(exitTimer);
      try {
        if (SUPPORTS_PROCESS_GROUPS && child.pid) process.kill(-child.pid, "SIGKILL");
        else if (child.exitCode === null) child.kill("SIGKILL");
      } catch {
        // Already exited.
      }
      if (error) rejectPromise(error);
      else resolvePromise();
    };

    const bootTimer = setTimeout(() => {
      finish(
        new Error(
          `diffgazer web mode did not become ready within ${WEB_BOOT_TIMEOUT_MS}ms:\n${stderr.slice(-1_000)}`,
        ),
      );
    }, WEB_BOOT_TIMEOUT_MS);

    let exitTimer;
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    void waitForWebReady(origin, () => settled)
      .then(() => {
        ready = true;
        clearTimeout(bootTimer);
        if (SUPPORTS_PROCESS_GROUPS && child.pid) process.kill(-child.pid, "SIGINT");
        else child.kill("SIGINT");
        exitTimer = setTimeout(() => {
          finish(
            new Error(
              `diffgazer web mode did not exit after SIGINT within ${WEB_EXIT_TIMEOUT_MS}ms`,
            ),
          );
        }, WEB_EXIT_TIMEOUT_MS);
      })
      .catch((error) => finish(error));

    // Exiting before the app was served is a failure whatever the exit code: a CLI that parses its
    // arguments wrong and prints help exits 0 without ever booting the server.
    child.once("exit", (exitCode, signal) => {
      if (!ready) {
        finish(
          new Error(
            `diffgazer web mode exited before serving the app (${exitCode ?? "null"}, ${signal ?? "null"}):\n${stderr.slice(-1_000)}`,
          ),
        );
        return;
      }
      finish(
        exitCode === 0 || signal === "SIGINT"
          ? null
          : new Error(`diffgazer web mode exited with code ${exitCode}`),
      );
    });
  });

  console.log("OK: diffgazer boots the embedded web server and serves HTML");
}

export async function runProductCliSmoke({ root, dgaddBin, diffgazerBin }) {
  if (!existsSync(diffgazerBin)) {
    throw new Error(
      `diffgazer CLI not built at ${diffgazerBin}; run pnpm --filter diffgazer build before smoke:cli`,
    );
  }

  const diffgazerPackage = JSON.parse(
    readFileSync(resolve(root, "cli/diffgazer/package.json"), "utf-8"),
  );

  const commands = [
    {
      name: "diffgazer --help",
      command: "node",
      args: [diffgazerBin, "--help"],
      expect: /--tui\s+Start the terminal UI/i,
      label: "product CLI help",
    },
    {
      name: "diffgazer --version",
      command: "node",
      args: [diffgazerBin, "--version"],
      expect: new RegExp(`^${escapeRegExp(diffgazerPackage.version)}\\s*$`),
      label: "product CLI version",
    },
    {
      name: "diffgazer --theme without --tui",
      command: "node",
      args: [diffgazerBin, "--theme", "classic"],
      expect: /--theme requires --tui\./,
      label: "product CLI rejects TUI-only theme",
      expectFailure: true,
    },
    {
      name: "dgadd --help",
      command: "node",
      args: [dgaddBin, "--help"],
      expect: /help|Usage|add/i,
      label: "installer CLI help",
    },
    {
      name: "dgadd add --help",
      command: "node",
      args: [dgaddBin, "add", "--help"],
      expect: INSTALLER_NAMESPACES,
      label: "installer ui and keys namespaces",
    },
  ];

  for (const check of commands) {
    const output = check.expectFailure
      ? await runFailureArgv(root, check.command, check.args)
      : await runArgv(check.command, check.args);

    if (!check.expect.test(output)) {
      throw new Error(
        `Smoke check failed for ${check.label}: expected ${check.expect}, got ${output.slice(0, 250)}`,
      );
    }

    console.log(`OK: ${check.name}`);
  }

  for (const exitInput of TUI_EXIT_INPUTS) {
    await runTuiBootSmoke(root, diffgazerBin, exitInput);
  }
  await runWebBootSmoke(root, diffgazerBin);
}
