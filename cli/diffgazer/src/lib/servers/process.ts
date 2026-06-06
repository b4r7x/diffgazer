import { execa, type ResultPromise } from "execa";
import { config as appConfig } from "../../config";

export interface ServerController {
  start: () => void;
  stop: () => Promise<void>;
}

export interface ProcessServerConfig {
  command: string;
  args: string[];
  cwd: string;
  port: number;
  env?: Record<string, string>;
  readyPattern: string;
  onReady?: (address: string) => void;
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

function isProcessErrorLike(error: unknown): error is ProcessErrorLike {
  return error !== null && typeof error === "object";
}

export function formatProcessError(error: unknown): string {
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

export function createProcessServer(
  config: ProcessServerConfig,
): ServerController {
  let serverProcess: ResultPromise | null = null;
  let signaledReady = false;

  async function confirmReady(address: string): Promise<boolean> {
    if (!config.readyCheck) {
      return true;
    }
    try {
      await config.readyCheck(address);
      return true;
    } catch (err) {
      console.error(formatProcessError(err));
      return false;
    }
  }

  function start(): void {
    if (serverProcess) {
      return;
    }

    signaledReady = false;

    let env = globalThis.process.env;
    if (config.env) {
      env = { ...globalThis.process.env, ...config.env };
    }

    const childProcess = execa(config.command, config.args, {
      cwd: config.cwd,
      env,
      stdout: "pipe",
      stderr: "pipe",
    });

    serverProcess = childProcess;

    childProcess.stdout?.on("data", (data: Buffer) => {
      if (childProcess !== serverProcess || signaledReady) {
        return;
      }

      if (data.toString().includes(config.readyPattern)) {
        signaledReady = true;
        const address = `http://localhost:${config.port}`;
        void confirmReady(address).then((ready) => {
          if (ready && childProcess === serverProcess) {
            config.onReady?.(address);
          }
        });
      }
    });

    childProcess.catch((err) => {
      if (childProcess !== serverProcess) {
        return;
      }

      if (!isProcessErrorLike(err) || !err.killed) {
        console.error(formatProcessError(err));
      }
    });
  }

  return {
    start,
    stop: async () => {
      if (!serverProcess) {
        return;
      }

      const child = serverProcess;
      serverProcess = null;
      child.kill("SIGTERM");

      const forceKillTimer = setTimeout(() => {
        child.kill("SIGKILL");
      }, appConfig.shutdown.forceKillMs);

      try {
        await child;
      } catch {
        // Process exits with signal codes throw here; ignore expected shutdown errors.
      } finally {
        clearTimeout(forceKillTimer);
      }
    },
  };
}
