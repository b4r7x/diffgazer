import {
  isApiError,
  type ShutdownResult,
  shutdownCloseBlockedResult,
  shutdownClosedResult,
  shutdownNetworkError,
} from "@diffgazer/core/api";
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
    return shutdownNetworkError();
  }

  window.close();

  if (window.closed) {
    return shutdownClosedResult();
  }

  return shutdownCloseBlockedResult();
}
