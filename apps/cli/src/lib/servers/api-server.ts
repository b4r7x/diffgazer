import {
  createProcessServer,
  type ServerController,
} from "./create-process-server.js";

export interface ApiServerConfig {
  cwd: string;
  port: number;
}

export function createApiServer(config: ApiServerConfig): ServerController {
  const projectRoot = process.cwd();
  return createProcessServer({
    command: "npx",
    args: ["tsx", "src/dev.ts"],
    cwd: config.cwd,
    port: config.port,
    env: { PORT: String(config.port), STARGAZER_PROJECT_ROOT: projectRoot },
    readyPattern: "Server running",
  });
}
