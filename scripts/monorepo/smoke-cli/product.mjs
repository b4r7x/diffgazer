import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn as spawnPty } from "node-pty";
import stripAnsi from "strip-ansi";
import { CommandFailedError, runArgv } from "../smoke-shared/command.mjs";

const TUI_BOOT_TIMEOUT_MS = 30_000;
const TUI_EXIT_TIMEOUT_MS = 10_000;

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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function runTuiBootSmoke(root, diffgazerBin) {
  let output = "";

  await new Promise((resolvePromise, rejectPromise) => {
    let sawBootFrame = false;
    let exitTimer;
    const terminal = spawnPty(process.execPath, [diffgazerBin, "--tui"], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: root,
      env: { ...process.env, NO_COLOR: "1", TERM: "xterm-256color" },
    });

    const bootTimer = setTimeout(() => {
      terminal.kill();
      rejectPromise(
        new Error(
          `TUI did not render its home or size gate within ${TUI_BOOT_TIMEOUT_MS}ms:\n${stripAnsi(output).slice(-1_000)}`,
        ),
      );
    }, TUI_BOOT_TIMEOUT_MS);

    terminal.onData((data) => {
      output = `${output}${data}`.slice(-64_000);
      if (sawBootFrame || !/(Main Menu|Terminal too small)/.test(stripAnsi(output))) return;

      sawBootFrame = true;
      clearTimeout(bootTimer);
      terminal.write("q");
      exitTimer = setTimeout(() => {
        terminal.kill();
        rejectPromise(
          new Error(
            `TUI did not exit after q within ${TUI_EXIT_TIMEOUT_MS}ms:\n${stripAnsi(output).slice(-1_000)}`,
          ),
        );
      }, TUI_EXIT_TIMEOUT_MS);
    });

    terminal.onExit(({ exitCode, signal }) => {
      clearTimeout(bootTimer);
      clearTimeout(exitTimer);
      if (!sawBootFrame) {
        rejectPromise(
          new Error(
            `TUI exited before rendering its home or size gate:\n${stripAnsi(output).slice(-1_000)}`,
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

  console.log("OK: diffgazer --tui boots in an 80x24 pseudo-terminal and exits with q");
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
      name: "dgadd ui item",
      command: "node",
      args: [dgaddBin, "add", "--help"],
      expect: /ui\/\*|ui/i,
      label: "installer ui namespace",
    },
    {
      name: "dgadd keys item",
      command: "node",
      args: [dgaddBin, "add", "--help"],
      expect: /keys\/\*|keys/i,
      label: "installer keys namespace",
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

  await runTuiBootSmoke(root, diffgazerBin);
}
