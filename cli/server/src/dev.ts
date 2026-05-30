import { parsePortEnv } from "@diffgazer/core/env";
import { getErrorMessage } from "@diffgazer/core/errors";
import { createApp } from "./index.js";
import { DEFAULT_DEV_SERVER_PORT, startDevServer } from "./http-server.js";
import { shutdownSessions } from "./features/review/sessions.js";

try {
  const app = createApp();
  const port = parsePortEnv(process.env.PORT, DEFAULT_DEV_SERVER_PORT);
  const server = startDevServer({
    fetch: app.fetch,
    port,
  });

  const shutdown = (): void => {
    shutdownSessions();
    server.close();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
} catch (error) {
  console.error(getErrorMessage(error));
  process.exitCode = 1;
}
