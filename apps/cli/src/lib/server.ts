import { serve, type ServerType } from "@hono/node-server";
import { createServer } from "@repo/server";

export interface ServerManagerOptions {
  port: number;
  hostname?: string;
}

export interface ServerAddress {
  port: number;
  hostname: string;
}

export interface ServerManager {
  start: () => Promise<ServerAddress>;
  stop: () => Promise<void>;
  isRunning: () => boolean;
  getAddress: () => ServerAddress | null;
}

export function createServerManager(options: ServerManagerOptions): ServerManager {
  const { port, hostname = "localhost" } = options;

  let server: ServerType | null = null;
  let currentAddress: ServerAddress | null = null;

  const start = async (): Promise<ServerAddress> => {
    if (server !== null) {
      throw new Error("Server is already running");
    }

    const app = createServer();

    return new Promise((resolve, reject) => {
      try {
        server = serve({
          fetch: app.fetch,
          port,
          hostname,
        });

        server.on("listening", () => {
          currentAddress = { port, hostname };
          resolve(currentAddress);
        });

        server.on("error", (error: Error) => {
          server = null;
          currentAddress = null;
          reject(error);
        });
      } catch (error) {
        server = null;
        currentAddress = null;
        reject(error);
      }
    });
  };

  const stop = async (): Promise<void> => {
    if (server === null) {
      return;
    }

    return new Promise((resolve, reject) => {
      server!.close((error) => {
        server = null;
        currentAddress = null;
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  };

  const isRunning = (): boolean => {
    return server !== null;
  };

  const getAddress = (): ServerAddress | null => {
    return currentAddress;
  };

  return {
    start,
    stop,
    isRunning,
    getAddress,
  };
}
