import {
  createProcessServer,
  type ServerController,
} from "./create-process-server.js";

export interface ApiServerConfig {
  cwd: string;
  port: number;
}

export function createApiServer(config: ApiServerConfig): ServerController {
  return createProcessServer({
    command: "npx",
    args: ["tsx", "src/dev.ts"],
    cwd: config.cwd,
    port: config.port,
    env: { PORT: String(config.port) },
    readyPattern: "Server running",
  });
}
