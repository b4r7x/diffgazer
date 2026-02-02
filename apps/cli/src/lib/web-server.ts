import { execa, type ResultPromise } from "execa";
import open from "open";

export type WebServerStatus = "starting" | "running" | "error";

export interface WebServerState {
  status: WebServerStatus;
  address: string | null;
  error: string | null;
}

export interface WebServerConfig {
  cwd: string;
  port: number;
}

export interface WebServer {
  getSnapshot: () => WebServerState;
  subscribe: (callback: () => void) => () => void;
  stop: () => void;
}

export function createWebServer(config: WebServerConfig): WebServer {
  const listeners = new Set<() => void>();
  let state: WebServerState = { status: "starting", address: null, error: null };
  let viteProcess: ResultPromise | null = null;

  function emit(): void {
    listeners.forEach((cb) => cb());
  }

  // Start immediately
  viteProcess = execa("npx", ["vite", "--port", String(config.port)], {
    cwd: config.cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  viteProcess.stdout?.on("data", (data: Buffer) => {
    if (data.toString().includes("Local:")) {
      const address = `http://localhost:${config.port}`;
      state = { status: "running", address, error: null };
      emit();
      void open(address);
    }
  });

  viteProcess.catch((err) => {
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
    stop: () => {
      viteProcess?.kill("SIGTERM");
    },
  };
}
