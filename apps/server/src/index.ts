import { serve } from "@hono/node-server";
import { createServer } from "./app.js";
import { config } from "./config/index.js";

const app = createServer();

const server = serve(
  {
    fetch: app.fetch,
    hostname: config.server.host,
    port: config.server.port,
  },
  (info) => {
    console.log(`Server running at http://${info.address}:${info.port}`);
  }
);

const shutdown = () => {
  server.close(() => {
    console.log("Server stopped");
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { server };
