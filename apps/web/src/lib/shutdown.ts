import { isApiError } from "@diffgazer/core/api";
import { toast } from "@diffgazer/ui/components/toast";
import { api } from "@/lib/api";

/** Outcome of stopping the app process and closing this browser tab. */
export type ShutdownResult =
  | { status: "closed" }
  | { status: "unsupported"; message: string }
  | { status: "error"; message: string };

const SHUTDOWN_CLOSE_BLOCKED_MESSAGE =
  "The app process was stopped, but this browser blocked automatic tab closing. Close this tab manually.";
export const SHUTDOWN_FAILED_MESSAGE =
  "Could not stop the app process from this environment. Use Ctrl+C in the terminal.";

export async function shutdown(): Promise<ShutdownResult> {
  try {
    await api.shutdown();
  } catch (error) {
    // A 503 from the server arrives as an ApiError carrying the operator's
    // specific guidance; surface it. Anything else is a transport failure.
    if (isApiError(error)) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: SHUTDOWN_FAILED_MESSAGE };
  }

  window.close();

  if (window.closed) {
    return { status: "closed" };
  }

  return { status: "unsupported", message: SHUTDOWN_CLOSE_BLOCKED_MESSAGE };
}

export function reportShutdownResult(result: ShutdownResult): void {
  if (result.status === "closed") return;
  if (result.status === "error") {
    toast.error("Quit Failed", { message: result.message });
    return;
  }
  toast.warning("Close Tab Manually", { message: result.message });
}
