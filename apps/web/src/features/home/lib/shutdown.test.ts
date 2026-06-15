import type { ApiError } from "@diffgazer/core/api";
import { SHUTDOWN_FAILED_MESSAGE } from "@diffgazer/core/api";
import { afterEach, describe, expect, it, vi } from "vitest";

function stubWindowClose(closedAfter: boolean) {
  const close = vi.fn(() => {
    Object.defineProperty(window, "closed", { configurable: true, value: closedAfter });
  });
  Object.defineProperty(window, "closed", { configurable: true, value: false });
  Object.defineProperty(window, "close", { configurable: true, value: close });
  return close;
}

const mockShutdown = vi.fn();

// Boundary mock: web api singleton wraps fetch; shutdown tests assert browser-close behavior around that request.
vi.mock("@/lib/api", () => ({
  api: {
    shutdown: (...args: unknown[]) => mockShutdown(...args),
  },
}));

const { shutdown } = await import("./shutdown");

function apiError(message: string, status: number): ApiError {
  const error = new Error(message) as ApiError;
  error.status = status;
  return error;
}

describe("shutdown", () => {
  afterEach(() => {
    mockShutdown.mockReset();
  });

  it("surfaces the server's 503 guidance when the request throws an ApiError", async () => {
    mockShutdown.mockRejectedValue(apiError("Shutdown is only available in packaged mode.", 503));

    const result = await shutdown();

    expect(result).toEqual({
      status: "error",
      message: "Shutdown is only available in packaged mode.",
    });
  });

  it("falls back to the default failed message on a non-ApiError failure", async () => {
    mockShutdown.mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await shutdown();

    expect(result).toEqual({ status: "error", message: SHUTDOWN_FAILED_MESSAGE });
  });

  it("reports closed when window.close actually closes the tab", async () => {
    mockShutdown.mockResolvedValue(undefined);
    const close = stubWindowClose(true);

    const result = await shutdown();

    expect(close).toHaveBeenCalledOnce();
    expect(result.status).toBe("closed");
  });

  it("reports a blocked close when the browser keeps the tab open", async () => {
    mockShutdown.mockResolvedValue(undefined);
    const close = stubWindowClose(false);

    const result = await shutdown();

    expect(close).toHaveBeenCalledOnce();
    expect(result.status).toBe("unsupported");
  });
});
