import type { AddressInfo } from "node:net";
import { createAdaptorServer, type ServerType } from "@hono/node-server";

export const DEFAULT_DEV_SERVER_HOSTNAME = "127.0.0.1";
export const DEFAULT_DEV_SERVER_PORT = 3000;

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

export function formatListenError(error: unknown, hostname: string, port: number): string {
  if (isErrnoException(error) && error.code === "EADDRINUSE") {
    const suggestedPort = port === DEFAULT_DEV_SERVER_PORT
      ? 3002
      : port < 65535
        ? port + 1
        : DEFAULT_DEV_SERVER_PORT;

    return [
      `Port ${port} is already in use on ${hostname}.`,
      "Stop the existing process or choose another API port:",
      `  PORT=${suggestedPort} pnpm --filter @diffgazer/server dev`,
      "If running apps/web against that port:",
      `  VITE_API_URL=http://${hostname}:${suggestedPort} pnpm --filter @diffgazer/web dev`,
    ].join("\n");
  }

  const message = error instanceof Error ? error.message : String(error);
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
  onReady = (info) => console.log(`Server running on http://localhost:${info.port}`),
  onError = (message) => console.error(message),
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
