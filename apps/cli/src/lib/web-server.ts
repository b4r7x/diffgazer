import open from "open";
import { createProcessServer, type ProcessServer } from "./create-process-server.js";

export interface WebServerConfig {
  cwd: string;
  port: number;
}

export function createWebServer(config: WebServerConfig): ProcessServer {
  return createProcessServer({
    command: "npx",
    args: ["vite", "--port", String(config.port)],
    cwd: config.cwd,
    port: config.port,
    readyPattern: "Local:",
    onReady: (address) => void open(address),
  });
}
