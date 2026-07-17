import { execa, type ResultPromise } from "execa";
import { config as appConfig } from "../../config";

export interface ServerController {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export interface ProcessServerConfig {
  command: string;
  args: string[];
  cwd: string;
  port: number;
  env?: Record<string, string>;
  readyPattern: string;
  /** Resolve the ready address from stdout; defaults to http://localhost:{port}. */
  resolveReadyAddress?: (output: string, defaultAddress: string) => string;
  onReady?: (address: string) => void;
  /** Called once when a started child fails unexpectedly. */
  onFailure?: (message: string) => void;
  /**
   * Optional readiness verification run after `readyPattern` is seen on stdout.
   * `onReady` fires only once this resolves, so a stdout banner alone does not
   * declare the server ready. Rejecting suppresses `onReady`.
   */
  readyCheck?: (address: string) => Promise<void>;
}

interface ProcessErrorLike {
  killed?: boolean;
  stderr?: unknown;
  shortMessage?: unknown;
  message?: unknown;
}

interface ProcessServerDependencies {
  spawn?: typeof execa;
  maxBuffer?: number;
  forceKillMs?: number;
}

const DIAGNOSTIC_TAIL_BYTES = 16 * 1024;
const READINESS_LINE_TAIL_BYTES = 16 * 1024;
const GROUP_EXIT_POLL_MS = 25;

function appendDiagnosticTail(current: Buffer, chunk: Buffer): Buffer {
  if (chunk.length >= DIAGNOSTIC_TAIL_BYTES) {
    return chunk.subarray(chunk.length - DIAGNOSTIC_TAIL_BYTES);
  }

  const overflow = current.length + chunk.length - DIAGNOSTIC_TAIL_BYTES;
  const retained = overflow > 0 ? current.subarray(overflow) : current;
  return Buffer.concat([retained, chunk]);
}

function consumeCompleteLines(tail: Buffer, chunk: Buffer): { lines: string[]; tail: Buffer } {
  const combined = tail.length === 0 ? chunk : Buffer.concat([tail, chunk]);
  const lines: string[] = [];
  let lineStart = 0;
  let newline = combined.indexOf(0x0a, lineStart);

  while (newline !== -1) {
    const lineEnd = newline > lineStart && combined[newline - 1] === 0x0d ? newline - 1 : newline;
    lines.push(combined.subarray(lineStart, lineEnd).toString());
    lineStart = newline + 1;
    newline = combined.indexOf(0x0a, lineStart);
  }

  const incomplete = combined.subarray(lineStart);
  return {
    lines,
    tail:
      incomplete.length > READINESS_LINE_TAIL_BYTES
        ? incomplete.subarray(incomplete.length - READINESS_LINE_TAIL_BYTES)
        : Buffer.from(incomplete),
  };
}

function isProcessErrorLike(error: unknown): error is ProcessErrorLike {
  return error !== null && typeof error === "object";
}

function formatProcessError(error: unknown): string {
  if (!isProcessErrorLike(error)) return String(error);

  if (typeof error.stderr === "string" && error.stderr.trim()) {
    return error.stderr.trim();
  }

  if (typeof error.shortMessage === "string" && error.shortMessage.trim()) {
    return error.shortMessage.trim();
  }

  if (typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  return String(error);
}

function formatProcessFailure(error: unknown, stderrTail: Buffer, stdoutTail: Buffer): string {
  const stderr = stderrTail.toString().trim();
  if (stderr) return stderr;

  const stdout = stdoutTail.toString().trim();
  return stdout || formatProcessError(error);
}

function isNoSuchProcess(error: unknown): boolean {
  return error !== null && typeof error === "object" && "code" in error && error.code === "ESRCH";
}

function signalChild(child: ResultPromise, signal: "SIGTERM" | "SIGKILL"): boolean {
  // Detached children lead their own group; signal the group (negative pid) so a
  // wrapper-spawned grandchild dies too. Fall back to the direct child on Windows,
  // when no pid is available, or if the group is already gone.
  const { pid } = child;
  if (process.platform !== "win32" && pid !== undefined) {
    try {
      process.kill(-pid, signal);
      return true;
    } catch (error) {
      child.kill(signal);
      return !isNoSuchProcess(error);
    }
  }
  child.kill(signal);
  return false;
}

function isProcessGroupAlive(pid: number): boolean {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    return !isNoSuchProcess(error);
  }
}

async function waitForProcessGroupExit(pid: number): Promise<void> {
  while (isProcessGroupAlive(pid)) {
    await new Promise((resolve) => setTimeout(resolve, GROUP_EXIT_POLL_MS));
  }
}

export function createProcessServer(
  config: ProcessServerConfig,
  dependencies: ProcessServerDependencies = {},
): ServerController {
  let serverProcess: ResultPromise | null = null;
  let signaledReady = false;
  let startPromise: Promise<void> | null = null;
  let resolveStart: (() => void) | null = null;
  let rejectStart: ((error: Error) => void) | null = null;
  let cleanupPromise: Promise<void> | null = null;
  let lifecycleVersion = 0;

  async function confirmReady(
    address: string,
    reportFailure: (error: unknown) => void,
  ): Promise<boolean> {
    if (!config.readyCheck) {
      return true;
    }
    try {
      await config.readyCheck(address);
      return true;
    } catch (err) {
      reportFailure(err);
      return false;
    }
  }

  async function terminateChild(child: ResultPromise): Promise<void> {
    const groupPid = process.platform === "win32" ? undefined : child.pid;
    const isGroupManaged = signalChild(child, "SIGTERM");
    const forceKillTimer = setTimeout(() => {
      signalChild(child, "SIGKILL");
    }, dependencies.forceKillMs ?? appConfig.shutdown.forceKillMs);

    try {
      await child;
    } catch {
      // Process exits with signal codes throw here; ignore expected shutdown errors.
    }

    if (isGroupManaged && groupPid !== undefined) {
      await waitForProcessGroupExit(groupPid);
    }
    clearTimeout(forceKillTimer);
  }

  function cleanupChild(child: ResultPromise): Promise<void> {
    if (cleanupPromise) return cleanupPromise;

    const cleanup = terminateChild(child).finally(() => {
      if (cleanupPromise === cleanup) cleanupPromise = null;
    });
    cleanupPromise = cleanup;
    return cleanup;
  }

  function start(): Promise<void> {
    if (startPromise) return startPromise;
    if (cleanupPromise) {
      const version = lifecycleVersion;
      const queuedStart = cleanupPromise.then(() => {
        if (version !== lifecycleVersion) {
          throw new Error("Server stopped before readiness");
        }
        if (startPromise === queuedStart) startPromise = null;
        return start();
      });
      startPromise = queuedStart;
      void queuedStart.catch(() => {
        if (startPromise === queuedStart) startPromise = null;
      });
      return queuedStart;
    }

    signaledReady = false;
    startPromise = new Promise<void>((resolve, reject) => {
      resolveStart = resolve;
      rejectStart = reject;
    });
    void startPromise.catch(() => undefined);

    let env = globalThis.process.env;
    if (config.env) {
      env = { ...globalThis.process.env, ...config.env };
    }

    const spawn = dependencies.spawn ?? execa;
    const childProcess = spawn(config.command, config.args, {
      cwd: config.cwd,
      env,
      stdout: "pipe",
      stderr: "pipe",
      buffer: false,
      ...(dependencies.maxBuffer === undefined ? {} : { maxBuffer: dependencies.maxBuffer }),
      // Lead a new process group on POSIX so stop() can signal the whole tree:
      // the wrapper binary (pnpm exec vite / npx tsx) cannot forward SIGKILL to a
      // hung grandchild still bound to the port, so we kill the group instead.
      detached: process.platform !== "win32",
    });

    serverProcess = childProcess;
    let stdoutTail: Buffer = Buffer.alloc(0);
    let readinessLineTail: Buffer = Buffer.alloc(0);
    let stderrTail: Buffer = Buffer.alloc(0);
    let failureReported = false;

    const reportFailure = (error: unknown): Error => {
      const message = formatProcessFailure(error, stderrTail, stdoutTail);
      if (!failureReported) {
        failureReported = true;
        console.error(message);
        config.onFailure?.(message);
      }
      return new Error(message, { cause: error });
    };

    childProcess.stdout?.on("data", (data: Buffer) => {
      if (childProcess !== serverProcess) return;

      stdoutTail = appendDiagnosticTail(stdoutTail, data);
      if (signaledReady) return;

      const consumed = consumeCompleteLines(readinessLineTail, data);
      readinessLineTail = consumed.tail;
      const readyLine = consumed.lines.find((line) => line.includes(config.readyPattern));
      if (readyLine !== undefined) {
        signaledReady = true;
        const defaultAddress = `http://localhost:${config.port}`;
        const address = config.resolveReadyAddress?.(readyLine, defaultAddress) ?? defaultAddress;
        void confirmReady(address, reportFailure).then((ready) => {
          if (ready && childProcess === serverProcess) {
            config.onReady?.(address);
            resolveStart?.();
            resolveStart = null;
            rejectStart = null;
          } else if (!ready && childProcess === serverProcess) {
            rejectStart?.(new Error(`Server readiness check failed: ${address}`));
            resolveStart = null;
            rejectStart = null;
            serverProcess = null;
            signaledReady = false;
            startPromise = null;
            void cleanupChild(childProcess);
          }
        });
      }
    });

    childProcess.stderr?.on("data", (data: Buffer) => {
      if (childProcess === serverProcess) {
        stderrTail = appendDiagnosticTail(stderrTail, data);
      }
    });

    void childProcess.then(
      () => {
        if (childProcess !== serverProcess) {
          return;
        }

        serverProcess = null;
        signaledReady = false;
        rejectStart?.(new Error("Server exited before readiness"));
        resolveStart = null;
        rejectStart = null;
        startPromise = null;
      },
      (err) => {
        if (childProcess !== serverProcess) {
          return;
        }

        serverProcess = null;
        signaledReady = false;

        if (!isProcessErrorLike(err) || !err.killed) {
          rejectStart?.(reportFailure(err));
        }
        resolveStart = null;
        rejectStart = null;
        startPromise = null;
      },
    );

    return startPromise;
  }

  return {
    start,
    stop: async () => {
      lifecycleVersion += 1;
      const child = serverProcess;
      serverProcess = null;
      signaledReady = false;
      rejectStart?.(new Error("Server stopped before readiness"));
      resolveStart = null;
      rejectStart = null;
      startPromise = null;
      if (child) {
        await cleanupChild(child);
      } else if (cleanupPromise) {
        await cleanupPromise;
      }
    },
  };
}
