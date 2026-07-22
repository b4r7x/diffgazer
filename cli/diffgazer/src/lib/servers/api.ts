import type { ServerController } from "./controller";
import { createProcessServer } from "./process/server";

export interface ApiServerConfig {
  cwd: string;
  port: number;
  projectRoot: string;
  onReady?: (address: string) => void;
  onFailure?: (message: string) => void;
}

const HEALTH_TIMEOUT_MS = 10_000;
const HEALTH_POLL_INTERVAL_MS = 200;
const DEV_SERVER_READY_PATTERN = '"event":"dev_server_ready"';

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

function remainingBudget(deadline: number, timeoutMs: number, now: () => number): number {
  const remaining = deadline - now();
  if (!Number.isFinite(remaining)) return 0;
  return Math.min(timeoutMs, Math.max(0, Math.ceil(remaining)));
}

export async function waitForHealthy({
  address,
  timeoutMs = HEALTH_TIMEOUT_MS,
  intervalMs = HEALTH_POLL_INTERVAL_MS,
  fetchImpl = fetch,
  sleep = defaultSleep,
  now = () => performance.now(),
}: WaitForHealthyOptions): Promise<void> {
  const url = `${address}/api/health`;
  const deadline = now() + timeoutMs;

  while (true) {
    const remainingMs = remainingBudget(deadline, timeoutMs, now);
    if (remainingMs <= 0) {
      throw new Error(`API server did not become healthy at ${url} within ${timeoutMs}ms.`);
    }

    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(remainingMs) });
      if (response.ok) {
        return;
      }
    } catch {
      // Server not accepting connections yet; retry until the deadline.
    }

    if (remainingBudget(deadline, timeoutMs, now) <= 0) {
      throw new Error(`API server did not become healthy at ${url} within ${timeoutMs}ms.`);
    }

    await sleep(intervalMs);
  }
}

export function createApiServer(config: ApiServerConfig): ServerController {
  return createProcessServer({
    command: "npx",
    args: ["tsx", "src/serve.ts"],
    cwd: config.cwd,
    port: config.port,
    env: {
      PORT: String(config.port),
      DIFFGAZER_PROJECT_ROOT: config.projectRoot,
      ...(process.env.DIFFGAZER_SHUTDOWN_TOKEN
        ? { DIFFGAZER_SHUTDOWN_TOKEN: process.env.DIFFGAZER_SHUTDOWN_TOKEN }
        : {}),
    },
    readyPattern: DEV_SERVER_READY_PATTERN,
    onReady: config.onReady,
    onFailure: config.onFailure,
    readyCheck: (address) => waitForHealthy({ address }),
  });
}
