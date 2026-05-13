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
    env: {
      PORT: String(config.port),
      DIFFGAZER_PROJECT_ROOT: projectRoot,
      ...(process.env.DIFFGAZER_SHUTDOWN_TOKEN
        ? { DIFFGAZER_SHUTDOWN_TOKEN: process.env.DIFFGAZER_SHUTDOWN_TOKEN }
        : {}),
    },
    readyPattern: "Server running",
  });
}
