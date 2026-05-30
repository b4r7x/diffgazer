import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

function readPositiveIntEnv(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  paths: {
    web: resolve(repoRoot, "apps/web"),
    server: resolve(repoRoot, "cli/server"),
  },
  ports: {
    api: 3000,
    web: 3001,
  },
  shutdown: {
    // Time to wait for servers to stop gracefully before exiting the CLI.
    gracefulMs: 3000,
    // After SIGTERM, time to wait before sending SIGKILL to a child process.
    // Overridable for slow shutdowns (e.g. CI) via DIFFGAZER_FORCE_KILL_DELAY_MS.
    forceKillMs: readPositiveIntEnv(process.env.DIFFGAZER_FORCE_KILL_DELAY_MS, 2000),
  },
} as const;
