import {
  isApiError,
  SHUTDOWN_CLOSE_BLOCKED_MESSAGE,
  SHUTDOWN_FAILED_MESSAGE,
  type ShutdownResult,
} from "@diffgazer/core/api";
import { toast } from "@diffgazer/ui/components/toast";
import { api } from "@/lib/api";

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
