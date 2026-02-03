import { execa, type ResultPromise } from "execa";

export type ApiServerStatus = "starting" | "running" | "error";

export interface ApiServerState {
  status: ApiServerStatus;
  address: string | null;
  error: string | null;
}

export interface ApiServerConfig {
  cwd: string;
  port: number;
}

export interface ApiServer {
  getSnapshot: () => ApiServerState;
  subscribe: (callback: () => void) => () => void;
  stop: () => void;
}

export function createApiServer(config: ApiServerConfig): ApiServer {
  const listeners = new Set<() => void>();
  let state: ApiServerState = { status: "starting", address: null, error: null };
  let serverProcess: ResultPromise | null = null;

  function emit(): void {
    listeners.forEach((cb) => cb());
  }

  serverProcess = execa("npx", ["tsx", "src/index.ts"], {
    cwd: config.cwd,
    env: { ...process.env, PORT: String(config.port) },
    stdout: "pipe",
    stderr: "pipe",
  });

  serverProcess.stdout?.on("data", (data: Buffer) => {
    if (data.toString().includes("Server running")) {
      state = { status: "running", address: `http://localhost:${config.port}`, error: null };
      emit();
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
