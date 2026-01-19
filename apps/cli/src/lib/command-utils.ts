import { createServerManager, type ServerManager } from "./server.js";
import { parsePort } from "@repo/schemas/port";

export const DEFAULT_HOST = "localhost";

export interface CommandOptions {
  port: string;
  hostname?: string;
}

export interface InitializedServer {
  manager: ServerManager;
  address: string;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
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

export interface ShutdownOptions {
  onStart?: () => void;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

export function createShutdownHandler(
  cleanup: () => Promise<void>,
  options: ShutdownOptions = {}
): () => Promise<void> {
  let isShuttingDown = false;

  return async (): Promise<void> => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    options.onStart?.();

    try {
      await cleanup();
      options.onSuccess?.();
      process.exit(0);
    } catch (error) {
      options.onError?.(error);
      process.exit(1);
    }
  };
}
