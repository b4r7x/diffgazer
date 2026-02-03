import { getErrorMessage } from "@stargazer/core";
import { execa, type ResultPromise } from "execa";
import { createServerStateStore } from "./server-store.js";
import type { ServerState } from "./server-store.js";

export interface ServerController {
  getSnapshot: () => ServerState;
  subscribe: (callback: () => void) => () => void;
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
  const store = createServerStateStore();
  let serverProcess: ResultPromise | null = null;

  function start(): void {
    if (serverProcess) {
      return;
    }

    store.setState({ status: "starting", address: null, error: null });

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
        store.setState({ status: "running", address, error: null });
        config.onReady?.(address);
      }
    });

    childProcess.catch((err) => {
      if (childProcess !== serverProcess) {
        return;
      }

      if (!err.killed) {
        store.setState({
          status: "error",
          address: null,
          error: getErrorMessage(err),
        });
      }
    });
  }

  return {
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    start,
    stop: () => {
      if (!serverProcess) {
        store.setIdle();
        return;
      }

      const process = serverProcess;
      serverProcess = null;
      process.kill("SIGTERM");
      store.setIdle();
    },
  };
}
