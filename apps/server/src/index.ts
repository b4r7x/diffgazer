import { serve } from "@hono/node-server";
import { createServer } from "./app.js";
import { config } from "./config/index.js";

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

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

const SHUTDOWN_TIMEOUT_MS = 10_000;

function shutdown(): void {
  console.log("Shutting down server...");

  const forceExitTimeout = setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  server.close(() => {
    clearTimeout(forceExitTimeout);
    console.log("Server stopped");
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { server };
