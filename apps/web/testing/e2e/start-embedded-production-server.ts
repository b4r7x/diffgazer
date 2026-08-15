import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createEmbeddedServer } from "../../../../cli/diffgazer/src/lib/servers/embedded.js";
import { ensureShutdownToken } from "../../../../cli/diffgazer/src/lib/shutdown-token.js";

const workspaceRoot = resolve(import.meta.dirname, "../../../..");
const packagedWebRoot = resolve(workspaceRoot, "cli/diffgazer/dist/web");
const port = Number(process.env.PLAYWRIGHT_PORT ?? process.env.PORT ?? 4173);

if (!existsSync(resolve(packagedWebRoot, "index.html"))) {
  console.error(
    `Built SPA not found at ${packagedWebRoot}. Run \`pnpm --filter diffgazer build\` before the embedded production e2e gate.`,
  );
  process.exit(1);
}

ensureShutdownToken();

const server = createEmbeddedServer({
  port,
  projectRoot: workspaceRoot,
  webRoot: packagedWebRoot,
  onReady: (address) => {
    console.log(`Embedded production e2e server ready at ${address}`);
  },
  onFailure: (message) => {
    console.error(message);
    process.exit(1);
  },
});

async function shutdown(): Promise<void> {
  await server.stop();
  process.exit(0);
}

process.once("SIGINT", () => {
  void shutdown();
});
process.once("SIGTERM", () => {
  void shutdown();
});

try {
  await server.start();
} catch {
  process.exit(1);
}
