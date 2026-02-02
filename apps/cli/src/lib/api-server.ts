import { createProcessServer, type ProcessServer } from "./create-process-server.js";

export interface ApiServerConfig {
  cwd: string;
  port: number;
}

export function createApiServer(config: ApiServerConfig): ProcessServer {
  return createProcessServer({
    command: "npx",
    args: ["tsx", "src/index.ts"],
    cwd: config.cwd,
    port: config.port,
    env: { PORT: String(config.port) },
    readyPattern: "Server running",
  });
}
