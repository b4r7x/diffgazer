import { execa, type ResultPromise } from "execa";

export type ServerStatus = "starting" | "running" | "error";

export interface ServerState {
  status: ServerStatus;
  address: string | null;
  error: string | null;
}

export interface ProcessServer {
  getSnapshot: () => ServerState;
  subscribe: (callback: () => void) => () => void;
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

export function createProcessServer(config: ProcessServerConfig): ProcessServer {
  const listeners = new Set<() => void>();
  let state: ServerState = { status: "starting", address: null, error: null };
  let serverProcess: ResultPromise | null = null;

  function emit(): void {
    listeners.forEach((cb) => cb());
  }

  serverProcess = execa(config.command, config.args, {
    cwd: config.cwd,
    env: config.env ? { ...process.env, ...config.env } : process.env,
    stdout: "pipe",
    stderr: "pipe",
  });

  serverProcess.stdout?.on("data", (data: Buffer) => {
    if (data.toString().includes(config.readyPattern)) {
      const address = `http://localhost:${config.port}`;
      state = { status: "running", address, error: null };
      emit();
      config.onReady?.(address);
    }
  });

  serverProcess.catch((err) => {
    if (!err.killed) {
      state = { status: "error", address: null, error: err.message };
      emit();
    }
  });

  return {
    getSnapshot: () => state,
    subscribe: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    stop: () => serverProcess?.kill("SIGTERM"),
  };
}
