import type { AddressInfo } from "node:net";
import { DEFAULT_API_PORT } from "@diffgazer/core/env";
import { getErrorMessage } from "@diffgazer/core/errors";
import { createAdaptorServer, type ServerType } from "@hono/node-server";
import { log } from "./shared/lib/log.js";

const DEFAULT_DEV_SERVER_HOSTNAME = "127.0.0.1";
export const DEFAULT_DEV_SERVER_PORT = DEFAULT_API_PORT;

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

export function formatListenError(error: unknown, hostname: string, port: number): string {
  if (isErrnoException(error) && error.code === "EADDRINUSE") {
    let suggestedPort = DEFAULT_DEV_SERVER_PORT;
    if (port === DEFAULT_DEV_SERVER_PORT) {
      suggestedPort = 3002;
    } else if (port < 65535) {
      suggestedPort = port + 1;
    }

    return [
      `Port ${port} is already in use on ${hostname}.`,
      "Stop the existing process or choose another API port:",
      `  PORT=${suggestedPort} pnpm --filter @diffgazer/server dev`,
      "If running apps/web against that port:",
      `  VITE_API_URL=http://${hostname}:${suggestedPort} pnpm --filter @diffgazer/web dev`,
    ].join("\n");
  }

  const message = getErrorMessage(error);
  return `Failed to start Diffgazer API server on ${hostname}:${port}: ${message}`;
}

export interface StartDevServerOptions {
  fetch: (request: Request, env: unknown) => Promise<unknown> | unknown;
  hostname?: string;
  port: number;
  onReady?: (info: AddressInfo) => void;
  onError?: (message: string, error: unknown) => void;
  exitOnError?: boolean;
}

export function startDevServer({
  fetch,
  hostname = DEFAULT_DEV_SERVER_HOSTNAME,
  port,
  onReady = (info) => log("info", "dev_server_ready", { url: `http://localhost:${info.port}` }),
  onError = (message) => log("error", "dev_server_error", { message }),
  exitOnError = true,
}: StartDevServerOptions): ServerType {
  const server = createAdaptorServer({ fetch, hostname, port });

  server.once("error", (error) => {
    onError(formatListenError(error, hostname, port), error);
    if (exitOnError) process.exitCode = 1;
  });

  server.listen(port, hostname, () => {
    const address = server.address();
    if (address && typeof address === "object") onReady(address);
  });

  return server;
}
