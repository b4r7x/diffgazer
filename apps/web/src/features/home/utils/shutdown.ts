import { api } from "@/lib/api";

export type ShutdownResult =
  | { status: "closed" }
  | { status: "unsupported"; message: string }
  | { status: "error"; message: string };

const CLOSE_BLOCKED_MESSAGE =
  "The app process was stopped, but this browser blocked automatic tab closing. Close this tab manually.";
const SHUTDOWN_FAILED_MESSAGE =
  "Could not stop the app process from this environment. Use Ctrl+C in the terminal.";

export async function shutdown(): Promise<ShutdownResult> {
  let response: { ok: boolean; message?: string };
  try {
    response = await api.shutdown();
  } catch {
    return {
      status: "error",
      message: SHUTDOWN_FAILED_MESSAGE,
    };
  }

  if (!response.ok) {
    return {
      status: "error",
      message: response.message ?? SHUTDOWN_FAILED_MESSAGE,
    };
  }

  if (typeof window === "undefined" || typeof window.close !== "function") {
    return {
      status: "unsupported",
      message: CLOSE_BLOCKED_MESSAGE,
    };
  }

  try {
    window.close();
  } catch {
    return {
      status: "unsupported",
      message: CLOSE_BLOCKED_MESSAGE,
    };
  }

  if (window.closed) {
    return { status: "closed" };
  }

  return {
    status: "unsupported",
    message: CLOSE_BLOCKED_MESSAGE,
  };
}
