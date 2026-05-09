import { createApp } from "./index.js";
import { parsePortEnv, startDevServer } from "./dev-server.js";

try {
  const app = createApp();
  const port = parsePortEnv(process.env.PORT);
  startDevServer({
    fetch: app.fetch,
    port,
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
