import { describe, expect, it } from "vitest";
import {
  SHUTDOWN_CLOSE_BLOCKED_MESSAGE,
  SHUTDOWN_FAILED_MESSAGE,
  shutdownCloseBlockedResult,
  shutdownClosedResult,
  shutdownNetworkError,
} from "./shutdown-result.js";

describe("shutdown result mapping", () => {
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
