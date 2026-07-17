import { createProcessServer, type ServerController } from "./process";

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
  return createProcessServer({
    command: "pnpm",
    args: ["exec", "vite", "--port", String(config.port)],
    cwd: config.cwd,
    port: config.port,
    env: { VITE_API_URL: config.apiUrl },
    readyPattern: "Local:",
    resolveReadyAddress: resolveViteReadyAddress,
    onReady: config.onReady,
    onFailure: config.onFailure,
  });
}
