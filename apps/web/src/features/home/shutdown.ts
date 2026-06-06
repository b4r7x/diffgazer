import {
  mapShutdownResponseToResult,
  type ShutdownResult,
  shutdownCloseBlockedResult,
  shutdownClosedResult,
  shutdownNetworkError,
} from "@diffgazer/core/api";
import { api } from "@/lib/api";

export async function shutdown(): Promise<ShutdownResult> {
  let response: Awaited<ReturnType<typeof api.shutdown>>;
  try {
    response = await api.shutdown();
  } catch {
    return shutdownNetworkError();
  }

  const errorResult = mapShutdownResponseToResult(response);
  if (errorResult) return errorResult;

  if (typeof window === "undefined" || typeof window.close !== "function") {
    return shutdownCloseBlockedResult();
  }

  try {
    window.close();
  } catch {
    return shutdownCloseBlockedResult();
  }

  if (window.closed) {
    return shutdownClosedResult();
  }

  return shutdownCloseBlockedResult();
}
