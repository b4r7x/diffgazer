import open from "open";
import { config } from "../../config.js";
import { createEmbeddedServer } from "../../lib/servers/embedded-server.js";
import type { ServerController } from "../../lib/servers/create-process-server.js";

export const prodServerFactories: Array<() => ServerController> = [
  () =>
    createEmbeddedServer({
      port: Number(process.env.PORT) || config.ports.api,
      projectRoot: process.cwd(),
      onReady: (address) => void open(address),
    }),
];
