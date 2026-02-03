import { execa, type ResultPromise } from "execa";

export interface ServerController {
  start: () => void;
  stop: () => void;
}

export interface ProcessServerConfig {
  command: string;
  args: string[];
  cwd: string;
  port: number;
  env?: Record<string, string>;
  readyPattern: string;
  onReady?: (address: string) => void;
}

export function createProcessServer(
  config: ProcessServerConfig,
): ServerController {
  let serverProcess: ResultPromise | null = null;

  function start(): void {
    if (serverProcess) {
      return;
    }

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
      if (childProcess !== serverProcess) {
        return;
      }

      if (data.toString().includes(config.readyPattern)) {
        const address = `http://localhost:${config.port}`;
        config.onReady?.(address);
      }
    });

    childProcess.catch((err) => {
      if (childProcess !== serverProcess) {
        return;
      }

      if (!err.killed) {
        console.error(err);
      }
    });
  }

  return {
    start,
    stop: () => {
      if (!serverProcess) {
        return;
      }

      const process = serverProcess;
      serverProcess = null;
      process.kill("SIGTERM");
    },
  };
}
