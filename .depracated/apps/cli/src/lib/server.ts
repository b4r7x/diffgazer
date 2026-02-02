import { serve, type ServerType } from "@hono/node-server";
import { createServer } from "@repo/server";
import { DEFAULT_HOST } from "@repo/core";

export interface ServerManagerOptions {
  port: number;
  hostname?: string;
  projectPath?: string;
}

export interface ServerAddress {
  port: number;
  hostname: string;
}

export function createServerManager(options: ServerManagerOptions) {
  const { port, hostname = DEFAULT_HOST, projectPath } = options;

  let server: ServerType | null = null;

  const start = async (): Promise<ServerAddress> => {
    if (server !== null) {
      throw new Error("Server is already running");
    }

    const app = createServer(projectPath);

    return new Promise((resolve, reject) => {
      try {
        server = serve({
          fetch: app.fetch,
          port,
          hostname,
        });

        server.once("listening", () => {
          resolve({ port, hostname });
        });

        server.once("error", (error: Error) => {
          server = null;
          reject(error);
        });
      } catch (error) {
        server = null;
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
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  };

  return {
    start,
    stop,
  };
}
