import { randomBytes } from "node:crypto";

let shutdownToken: string | undefined;

export function ensureShutdownToken(): string {
  shutdownToken ??= randomBytes(32).toString("hex");
  process.env.DIFFGAZER_SHUTDOWN_TOKEN = shutdownToken;
  process.env.VITE_DIFFGAZER_SHUTDOWN_TOKEN = shutdownToken;
  return shutdownToken;
}
