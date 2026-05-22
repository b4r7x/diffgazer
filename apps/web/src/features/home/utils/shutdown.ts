import { api } from "@/lib/api";
import {
  mapShutdownResponseToResult,
  shutdownCloseBlockedResult,
  shutdownClosedResult,
  shutdownNetworkError,
  type ShutdownResult,
} from "@diffgazer/core/api";

export async function shutdown(): Promise<ShutdownResult> {
  let response;
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
