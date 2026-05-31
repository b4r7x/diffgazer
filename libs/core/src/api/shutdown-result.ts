import type { ShutdownResponse } from "./types.js";

export type ShutdownResult =
  | { status: "closed" }
  | { status: "unsupported"; message: string }
  | { status: "error"; message: string };

export const SHUTDOWN_CLOSE_BLOCKED_MESSAGE =
  "The app process was stopped, but this browser blocked automatic tab closing. Close this tab manually.";
export const SHUTDOWN_FAILED_MESSAGE =
  "Could not stop the app process from this environment. Use Ctrl+C in the terminal.";

export function mapShutdownResponseToResult(response: ShutdownResponse): ShutdownResult | null {
  if (!response.ok) {
    return { status: "error", message: response.message ?? SHUTDOWN_FAILED_MESSAGE };
  }
  return null;
}

export function shutdownNetworkError(): ShutdownResult {
  return { status: "error", message: SHUTDOWN_FAILED_MESSAGE };
}

export function shutdownClosedResult(): ShutdownResult {
  return { status: "closed" };
}

export function shutdownCloseBlockedResult(): ShutdownResult {
  return { status: "unsupported", message: SHUTDOWN_CLOSE_BLOCKED_MESSAGE };
}
