import {
  createProcessServer,
  type ServerController,
} from "./create-process-server";

export interface WebServerConfig {
  cwd: string;
  port: number;
  onReady?: (address: string) => void;
}

export function createWebServer(config: WebServerConfig): ServerController {
  return createProcessServer({
    command: "pnpm",
    args: ["exec", "vite", "--port", String(config.port)],
    cwd: config.cwd,
    port: config.port,
    readyPattern: "Local:",
    onReady: config.onReady,
  });
}
