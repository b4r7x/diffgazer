import { config } from "../../config.js";
import { createApiServer } from "../../lib/servers/api-server.js";
import { createWebServer } from "../../lib/servers/web-server.js";
import type { ServerController } from "../../lib/servers/create-process-server.js";

export const devServerFactories: Array<() => ServerController> = [
  () =>
    createApiServer({
      cwd: config.paths.server,
      port: config.ports.api,
    }),
  () =>
    createWebServer({
      cwd: config.paths.web,
      port: config.ports.web,
    }),
];
