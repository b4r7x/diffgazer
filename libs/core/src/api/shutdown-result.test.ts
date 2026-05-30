import { describe, expect, it } from "vitest";
import {
  SHUTDOWN_CLOSE_BLOCKED_MESSAGE,
  SHUTDOWN_FAILED_MESSAGE,
  mapShutdownResponseToResult,
  shutdownCloseBlockedResult,
  shutdownClosedResult,
  shutdownNetworkError,
} from "./shutdown-result";

describe("shutdown result mapping", () => {
  describe("mapShutdownResponseToResult", () => {
    it("returns null when response is ok (caller proceeds to close)", () => {
      expect(mapShutdownResponseToResult({ ok: true })).toBeNull();
    });

    it("returns error with provided message when response is not ok", () => {
      const result = mapShutdownResponseToResult({ ok: false, message: "denied" });
      expect(result).toEqual({ status: "error", message: "denied" });
    });

    it("falls back to the default failed message when response message is missing", () => {
      const result = mapShutdownResponseToResult({ ok: false });
      expect(result).toEqual({ status: "error", message: SHUTDOWN_FAILED_MESSAGE });
    });
  });

  describe("result factories", () => {
    it("shutdownNetworkError returns an error result with the default failed message", () => {
      expect(shutdownNetworkError()).toEqual({ status: "error", message: SHUTDOWN_FAILED_MESSAGE });
    });

    it("shutdownClosedResult marks the tab as closed", () => {
      expect(shutdownClosedResult()).toEqual({ status: "closed" });
    });

    it("shutdownCloseBlockedResult returns unsupported with the close-blocked message", () => {
      expect(shutdownCloseBlockedResult()).toEqual({
        status: "unsupported",
        message: SHUTDOWN_CLOSE_BLOCKED_MESSAGE,
      });
    });
  });
});
