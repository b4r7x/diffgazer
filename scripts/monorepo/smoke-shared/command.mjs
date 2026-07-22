import { spawn } from "node:child_process";

export class CommandFailedError extends Error {
  constructor(cmd, { exitCode, stdout, stderr, cause } = {}) {
    super(`Command failed (exit ${exitCode}): ${cmd}`);
    this.name = "CommandFailedError";
    this.cmd = cmd;
    this.exitCode = exitCode ?? null;
    this.stdout = stdout ?? "";
    this.stderr = stderr ?? "";
    if (cause !== undefined) this.cause = cause;
  }

  get output() {
    return `${this.stdout}${this.stderr}`;
  }
}

export class CommandTimedOutError extends Error {
  constructor(cmd, { timeoutMs, stdout, stderr, cause }) {
    super(`Command timed out after ${timeoutMs}ms: ${cmd}`);
    this.name = "CommandTimedOutError";
    this.cmd = cmd;
    this.timeoutMs = timeoutMs;
    this.stdout = stdout;
    this.stderr = stderr;
    if (cause !== undefined) this.cause = cause;
  }

  get output() {
    return `${this.stdout}${this.stderr}`;
  }
}

const DEFAULT_COMMAND_TIMEOUT_MS = 600_000;
const DEFAULT_TERMINATION_GRACE_MS = 1_000;
const PROCESS_GROUP_EXIT_TIMEOUT_MS = 5_000;
const SUPPORTS_PROCESS_GROUPS = process.platform !== "win32";

function signalProcessTree(child, processGroupId, signal) {
  try {
    if (processGroupId) process.kill(-processGroupId, signal);
    else if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

function processGroupExists(processGroupId) {
  try {
    process.kill(-processGroupId, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    if (error?.code === "EPERM") return true;
    throw error;
  }
}

async function waitForProcessGroupExit(processGroupId) {
  const deadline = Date.now() + PROCESS_GROUP_EXIT_TIMEOUT_MS;
  while (processGroupExists(processGroupId)) {
    if (Date.now() >= deadline) return false;
    await new Promise((resolveImmediate) => setImmediate(resolveImmediate));
  }
  return true;
}

export function runArgv(command, args, cwdOrOptions = {}) {
  const options = typeof cwdOrOptions === "string" ? { cwd: cwdOrOptions } : cwdOrOptions;
  const cmdLabel = `${command} ${args.join(" ")}`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
  const terminationGraceMs = options.terminationGraceMs ?? DEFAULT_TERMINATION_GRACE_MS;

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ? { ...process.env, ...options.env } : undefined,
      stdio: ["ignore", "pipe", "pipe"],
      detached: SUPPORTS_PROCESS_GROUPS,
    });
    const processGroupId = SUPPORTS_PROCESS_GROUPS ? child.pid : undefined;
    let stdout = "";
    let stderr = "";
    let spawnError;
    let timedOut = false;
    let directClosed = false;
    let directExitCode = null;
    let terminationFinished = false;
    let terminationError;
    let settled = false;
    let killTimer;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", (error) => {
      spawnError = error;
    });

    const settle = () => {
      if (settled || !directClosed || (timedOut && !terminationFinished)) return;
      settled = true;

      if (timedOut) {
        rejectPromise(
          new CommandTimedOutError(cmdLabel, {
            timeoutMs,
            stdout,
            stderr,
            cause: terminationError,
          }),
        );
        return;
      }
      if (spawnError) {
        rejectPromise(
          new CommandFailedError(cmdLabel, { exitCode: null, stdout, stderr, cause: spawnError }),
        );
        return;
      }
      if (directExitCode !== 0) {
        rejectPromise(
          new CommandFailedError(cmdLabel, { exitCode: directExitCode, stdout, stderr }),
        );
        return;
      }
      resolvePromise(stdout);
    };

    const finishTermination = async () => {
      try {
        signalProcessTree(child, processGroupId, "SIGKILL");
        if (processGroupId && !(await waitForProcessGroupExit(processGroupId))) {
          throw new Error(
            `Process group ${processGroupId} remained alive after SIGKILL for ${PROCESS_GROUP_EXIT_TIMEOUT_MS}ms`,
          );
        }
      } catch (error) {
        terminationError ??= error;
      }
      terminationFinished = true;
      settle();
    };

    const timeout = setTimeout(() => {
      timedOut = true;
      try {
        signalProcessTree(child, processGroupId, "SIGTERM");
      } catch (error) {
        terminationError = error;
      }
      killTimer = setTimeout(() => void finishTermination(), terminationGraceMs);
    }, timeoutMs);

    child.once("close", (exitCode) => {
      directClosed = true;
      directExitCode = exitCode;
      clearTimeout(timeout);
      if (!timedOut) clearTimeout(killTimer);
      settle();
    });
  });
}
