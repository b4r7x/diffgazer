import { createServerManager } from "./server.js";
import { parsePort } from "@repo/schemas/port";
import { getErrorMessage } from "@repo/core";
import { DEFAULT_HOST } from "./constants.js";

export { DEFAULT_HOST } from "./constants.js";

export interface CommandOptions {
  port: string;
  hostname?: string;
}

export interface InitializedServer {
  manager: ReturnType<typeof createServerManager>;
  address: string;
}

export async function initializeServer(options: CommandOptions): Promise<InitializedServer> {
  const port = parsePort(options.port);
  const hostname = options.hostname ?? DEFAULT_HOST;
  const manager = createServerManager({ port, hostname });
  const serverAddress = await manager.start();
  return { manager, address: `http://${serverAddress.hostname}:${serverAddress.port}` };
}

export function registerShutdownHandlers(shutdown: () => Promise<void>): void {
  const handler = () => void shutdown();
  process.on("SIGINT", handler);
  process.on("SIGTERM", handler);
}

export function createShutdownHandler(cleanup: () => Promise<void>): () => Promise<void> {
  let isShuttingDown = false;

  return async (): Promise<void> => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    try {
      await cleanup();
      process.exit(0);
    } catch (error) {
      console.error("Shutdown error:", getErrorMessage(error));
      process.exit(1);
    }
  };
}
