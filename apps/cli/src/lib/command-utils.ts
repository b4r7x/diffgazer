import chalk from "chalk";
import { createServerManager } from "./server.js";
import { getErrorMessage } from "@repo/core";
import { PortSchema } from "@repo/schemas/port";
import { DEFAULT_HOST } from "@repo/core";

function parsePort(value: string): number {
  const result = PortSchema.safeParse(value);
  if (!result.success) {
    throw new Error("Invalid port number");
  }
  return result.data;
}

export interface CommandOptions {
  port: string;
  hostname?: string;
}

export type ServerManager = ReturnType<typeof createServerManager>;

export interface InitializedServer {
  manager: ServerManager;
  address: string;
}

export async function initializeServer(options: CommandOptions): Promise<InitializedServer> {
  const port = parsePort(options.port);
  const hostname = options.hostname ?? DEFAULT_HOST;
  const manager = createServerManager({ port, hostname });
  const serverAddress = await manager.start();
  return { manager, address: `http://${serverAddress.hostname}:${serverAddress.port}` };
}

export async function withServer<T>(
  options: CommandOptions,
  handler: (manager: ServerManager, address: string) => Promise<T>
): Promise<T> {
  let manager: ServerManager;
  let address: string;
  try {
    ({ manager, address } = await initializeServer(options));
  } catch (error) {
    console.error(chalk.red(`Error: ${getErrorMessage(error)}`));
    process.exit(1);
  }
  return handler(manager, address);
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
