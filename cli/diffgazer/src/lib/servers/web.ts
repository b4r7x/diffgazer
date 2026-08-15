import { createProcessServer } from "./process/server";
import type { ServerController } from "./types";

export interface WebServerConfig {
  cwd: string;
  port: number;
  apiUrl: string;
  onReady?: (address: string) => void;
  onFailure?: (message: string) => void;
}

const VITE_LOCAL_ADDRESS = /Local:\s+(https?:\/\/\S+)/i;

export function resolveViteReadyAddress(output: string, defaultAddress: string): string {
  const match = output.match(VITE_LOCAL_ADDRESS);
  if (!match?.[1]) {
    return defaultAddress;
  }

  return match[1].replace(/\/$/, "");
}

export function createWebServer(config: WebServerConfig): ServerController {
  // The API child enforces the ensured DIFFGAZER_SHUTDOWN_TOKEN it inherits, but
  // Vite only exposes VITE_-prefixed vars to the SPA, so the same token is
  // re-published under the prefix the web client's fallback reads. Without it,
  // every dev SPA request 401s against the token-gated API.
  const shutdownToken = process.env.DIFFGAZER_SHUTDOWN_TOKEN;
  return createProcessServer({
    command: "pnpm",
    args: ["exec", "vite", "--port", String(config.port)],
    cwd: config.cwd,
    port: config.port,
    env: {
      VITE_API_URL: config.apiUrl,
      ...(shutdownToken ? { VITE_DIFFGAZER_SHUTDOWN_TOKEN: shutdownToken } : {}),
    },
    readyPattern: "Local:",
    resolveReadyAddress: resolveViteReadyAddress,
    onReady: config.onReady,
    onFailure: config.onFailure,
  });
}
