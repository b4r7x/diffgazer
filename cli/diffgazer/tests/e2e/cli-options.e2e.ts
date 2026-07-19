import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const cliEntry = resolve(repoRoot, "cli/diffgazer/src/index.tsx");
const defaultTimeoutMs = 30_000;
const terminationGraceMs = 250;
const processGroupExitTimeoutMs = 2_000;
const pollIntervalMs = 20;

interface CommandResult {
  status: number | null;
  stderr: string;
  stdout: string;
}

interface RunCommandOptions {
  cwd?: string;
  timeoutMs?: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function isMissingProcess(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ESRCH";
}

function formatArgv(command: string, args: string[]): string {
  return [command, ...args].map((value) => JSON.stringify(value)).join(" ");
}

function processGroupExists(processGroupId: number): boolean {
  try {
    process.kill(-processGroupId, 0);
    return true;
  } catch (error) {
    if (isMissingProcess(error)) return false;
    throw error;
  }
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (isMissingProcess(error)) return false;
    throw error;
  }
}

async function waitForProcessExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (processExists(pid)) {
    if (Date.now() >= deadline) return false;
    await delay(pollIntervalMs);
  }
  return true;
}

async function waitForProcessGroupExit(
  processGroupId: number,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (processGroupExists(processGroupId)) {
    if (Date.now() >= deadline) return false;
    await delay(pollIntervalMs);
  }
  return true;
}

function signalProcessGroup(processGroupId: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-processGroupId, signal);
  } catch (error) {
    if (!isMissingProcess(error)) throw error;
  }
}

async function terminatePosixProcessGroup(processGroupId: number): Promise<void> {
  signalProcessGroup(processGroupId, "SIGTERM");
  if (await waitForProcessGroupExit(processGroupId, terminationGraceMs)) return;

  signalProcessGroup(processGroupId, "SIGKILL");
  if (!(await waitForProcessGroupExit(processGroupId, processGroupExitTimeoutMs))) {
    throw new Error(`Process group ${processGroupId} remained alive after SIGKILL`);
  }
}

async function terminateWindowsProcessTree(pid: number): Promise<void> {
  try {
    await new Promise<void>((resolveTaskkill, rejectTaskkill) => {
      const taskkill = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
      const timeout = setTimeout(() => {
        taskkill.kill();
        rejectTaskkill(new Error(`taskkill did not finish within ${processGroupExitTimeoutMs}ms`));
      }, processGroupExitTimeoutMs);

      taskkill.once("error", (error) => {
        clearTimeout(timeout);
        rejectTaskkill(error);
      });
      taskkill.once("close", (status) => {
        clearTimeout(timeout);
        if (status === 0) {
          resolveTaskkill();
          return;
        }
        rejectTaskkill(new Error(`taskkill exited with status ${status ?? "unknown"}`));
      });
    });
  } catch (taskkillError) {
    try {
      process.kill(pid, "SIGKILL");
    } catch (error) {
      if (!isMissingProcess(error)) {
        throw new Error("taskkill failed and the direct-process fallback also failed", {
          cause: new AggregateError([taskkillError, error]),
        });
      }
    }
    if (!(await waitForProcessExit(pid, processGroupExitTimeoutMs))) {
      throw new Error("taskkill failed and the direct process remained alive", {
        cause: taskkillError,
      });
    }
    throw new Error(
      "taskkill failed; the direct process was killed, but descendant cleanup could not be guaranteed",
      { cause: taskkillError },
    );
  }
}

function capturedOutput(value: string): string {
  return value.length > 0 ? value : "<empty>";
}

async function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions = {},
): Promise<CommandResult> {
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  const child = spawn(command, args, {
    cwd: options.cwd,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let stderr = "";
  let stdout = "";
  let timedOut = false;
  let directClosed = false;
  let termination: Promise<void> | undefined;
  let terminationError: unknown;
  let finishTimeout: (() => void) | undefined;

  child.stderr.setEncoding("utf8");
  child.stdout.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });

  const closed = new Promise<number | null>((resolveClose, rejectClose) => {
    child.once("error", rejectClose);
    child.once("close", (status) => {
      directClosed = true;
      resolveClose(status);
    });
  });
  const timeoutFinished = new Promise<void>((resolveTimeout) => {
    finishTimeout = resolveTimeout;
  });

  const timeout = setTimeout(() => {
    timedOut = true;
    if (child.pid === undefined) return;

    termination =
      process.platform === "win32"
        ? terminateWindowsProcessTree(child.pid)
        : terminatePosixProcessGroup(child.pid);
    termination = termination
      .catch((error: unknown) => {
        terminationError = error;
      })
      .finally(() => finishTimeout?.());
  }, timeoutMs);

  try {
    let status: number | null;
    try {
      status = await Promise.race([closed, timeoutFinished.then(() => null)]);
    } catch (error) {
      throw new Error(
        `Command failed to start: ${formatArgv(command, args)}\nstdout:\n${capturedOutput(stdout)}\nstderr:\n${capturedOutput(stderr)}`,
        { cause: error },
      );
    }
    if (!timedOut) return { status, stderr, stdout };

    await (termination ?? timeoutFinished);

    if (!directClosed) {
      await Promise.race([closed.catch(() => null), delay(processGroupExitTimeoutMs)]);
      if (!directClosed) {
        const closeMessage = `the direct child did not emit close within ${processGroupExitTimeoutMs}ms`;
        terminationError =
          terminationError instanceof Error
            ? new Error(`${terminationError.message}; ${closeMessage}`, { cause: terminationError })
            : new Error(closeMessage);
      }
    }

    const cleanupDiagnostic =
      terminationError instanceof Error ? `\ncleanup:\n${terminationError.message}` : "";
    throw new Error(
      `Command timed out after ${timeoutMs}ms: ${formatArgv(command, args)}\nstdout:\n${capturedOutput(stdout)}\nstderr:\n${capturedOutput(stderr)}${cleanupDiagnostic}`,
      { cause: terminationError },
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function runDiffgazer(args: string[]): Promise<CommandResult> {
  return runCommand(process.execPath, ["--import", "tsx", cliEntry, ...args], { cwd: repoRoot });
}

describe("command runner", () => {
  test("returns promptly with the complete result when a command finishes", async () => {
    const result = await runCommand(
      process.execPath,
      ["-e", 'process.stdout.write("done"); process.stderr.write("note"); process.exitCode = 7;'],
      { timeoutMs: 5_000 },
    );

    expect(result).toEqual({ status: 7, stdout: "done", stderr: "note" });
  });

  test.skipIf(process.platform === "win32")(
    "kills a SIGTERM-resistant descendant and reports exact timeout diagnostics",
    async () => {
      const childScript = [
        'const { spawn } = require("node:child_process");',
        'process.on("SIGTERM", () => {});',
        'const descendant = spawn(process.execPath, ["-e", "process.on(\'SIGTERM\', () => {}); process.send(\'ready\'); setInterval(() => {}, 1000000);"], { stdio: ["ignore", "ignore", "ignore", "ipc"] });',
        'descendant.once("message", () => {',
        'process.stdout.write("runner-ready:" + process.pid + ":" + descendant.pid + "\\nparent-output");',
        'process.stderr.write("parent-error");',
        "});",
        "setInterval(() => {}, 1000000);",
      ].join("");
      const args = ["-e", childScript];
      let parentPid: number | undefined;
      let descendantPid: number | undefined;
      let cleanupError: unknown;

      try {
        await runCommand(process.execPath, args, { timeoutMs: 2_000 });
        throw new Error("Expected the command to time out");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const message = (error as Error).message;
        const ready = message.match(/runner-ready:(\d+):(\d+)/);
        expect(ready).not.toBeNull();
        parentPid = Number(ready?.[1]);
        descendantPid = Number(ready?.[2]);

        expect(message).toContain(
          `Command timed out after 2000ms: ${formatArgv(process.execPath, args)}`,
        );
        expect(message).toContain("stdout:\nrunner-ready:");
        expect(message).toContain("parent-output");
        expect(message).toContain("stderr:\nparent-error");
        expect(() => process.kill(parentPid as number, 0)).toThrow(
          expect.objectContaining({ code: "ESRCH" }),
        );
        expect(() => process.kill(descendantPid as number, 0)).toThrow(
          expect.objectContaining({ code: "ESRCH" }),
        );
      } finally {
        if (parentPid !== undefined && processGroupExists(parentPid)) {
          signalProcessGroup(parentPid, "SIGKILL");
          await waitForProcessGroupExit(parentPid, processGroupExitTimeoutMs);
        }
        if (descendantPid !== undefined) {
          try {
            process.kill(descendantPid, "SIGKILL");
          } catch (error) {
            if (!isMissingProcess(error)) cleanupError = error;
          }
        }
      }
      if (cleanupError) throw cleanupError;
    },
  );
});

describe("diffgazer CLI options", () => {
  test("prints help without starting servers", async () => {
    const { stdout } = await runDiffgazer(["--help"]);

    expect(stdout).toMatch(/Usage: diffgazer \[options\]/);
    expect(stdout).toMatch(/--tui\s+Start the terminal UI/);
    expect(stdout).toMatch(
      /--theme <theme>\s+Start TUI with a theme: auto, dark, light, high-contrast \(only with --tui\)/,
    );
  });

  test("prints a version without reading package.json at runtime", async () => {
    // The published binary injects package.json's version at build time (tsup
    // `define`). Run from source via tsx the define is absent, so the CLI must
    // fall back to the documented dev placeholder instead of crashing on a
    // missing/renamed package.json.
    const { stdout } = await runDiffgazer(["--version"]);
    expect(stdout.trim()).toBe("0.0.0-dev");
  });

  test("exits with an error for invalid options", async () => {
    const result = await runDiffgazer(["--theme", "classic"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/--theme requires --tui\./);
  });
});
