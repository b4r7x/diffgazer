import {
  createProcessServer,
  type ServerController,
} from "./process";

export interface ApiServerConfig {
  cwd: string;
  port: number;
  onReady?: (address: string) => void;
}

const HEALTH_TIMEOUT_MS = 10_000;
const HEALTH_POLL_INTERVAL_MS = 200;

export interface WaitForHealthyOptions {
  address: string;
  timeoutMs?: number;
  intervalMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function waitForHealthy({
  address,
  timeoutMs = HEALTH_TIMEOUT_MS,
  intervalMs = HEALTH_POLL_INTERVAL_MS,
  fetchImpl = fetch,
  sleep = defaultSleep,
  now = Date.now,
}: WaitForHealthyOptions): Promise<void> {
  const url = `${address}/api/health`;
  const deadline = now() + timeoutMs;

  while (true) {
    try {
      const response = await fetchImpl(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Server not accepting connections yet; retry until the deadline.
    }

    if (now() >= deadline) {
      throw new Error(`API server did not become healthy at ${url} within ${timeoutMs}ms.`);
    }

    await sleep(intervalMs);
  }
}

export function createApiServer(config: ApiServerConfig): ServerController {
  const projectRoot = process.cwd();
  return createProcessServer({
    command: "npx",
    args: ["tsx", "src/serve.ts"],
    cwd: config.cwd,
    port: config.port,
    env: {
      PORT: String(config.port),
      DIFFGAZER_PROJECT_ROOT: projectRoot,
      ...(process.env.DIFFGAZER_SHUTDOWN_TOKEN
        ? { DIFFGAZER_SHUTDOWN_TOKEN: process.env.DIFFGAZER_SHUTDOWN_TOKEN }
        : {}),
    },
    readyPattern: "Server running",
    onReady: config.onReady,
    readyCheck: (address) => waitForHealthy({ address }),
  });
}
