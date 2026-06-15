import { parsePortEnv } from "@diffgazer/core/env";
import { getErrorMessage } from "@diffgazer/core/errors";
import { createApp } from "./app.js";
import { shutdownSessions } from "./features/review/stream/store.js";
import { DEFAULT_DEV_SERVER_PORT, startDevServer } from "./http-server.js";
import { log } from "./shared/lib/log.js";

try {
  const app = createApp();
  const port = parsePortEnv(process.env.PORT, DEFAULT_DEV_SERVER_PORT);
  const server = startDevServer({
    fetch: app.fetch,
    port,
  });

  const shutdown = (): void => {
    // Abort active reviews and close subscribers first so no in-flight work or
    // SSE client keeps the server alive, then close the HTTP server and exit.
    shutdownSessions();
    server.close(() => {
      process.exit(0);
    });
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
} catch (error) {
  log("error", "dev_server_start_failed", { error: getErrorMessage(error) });
  process.exitCode = 1;
}
