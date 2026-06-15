import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelSessionsForProject,
  registerSession,
  unregisterSession,
} from "./session-registry.js";

describe("session-registry", () => {
  beforeEach(() => {
    unregisterSession("a");
    unregisterSession("b");
  });

  it("cancels every registered session matching the project key", () => {
    const cancelA = vi.fn();
    const cancelB = vi.fn();
    registerSession("a", { projectKey: "/project", cancel: cancelA });
    registerSession("b", { projectKey: "/project", cancel: cancelB });

    cancelSessionsForProject("/project", { reason: "trust_revoked" });

    expect(cancelA).toHaveBeenCalledWith({ reason: "trust_revoked" });
    expect(cancelB).toHaveBeenCalledWith({ reason: "trust_revoked" });
  });

  it("skips sessions registered under a different project key", () => {
    const cancelOther = vi.fn();
    registerSession("a", { projectKey: "/other", cancel: cancelOther });

    cancelSessionsForProject("/project");

    expect(cancelOther).not.toHaveBeenCalled();
  });

  it("stops cancelling a session after it is unregistered", () => {
    const cancel = vi.fn();
    registerSession("a", { projectKey: "/project", cancel });

    unregisterSession("a");
    cancelSessionsForProject("/project");

    expect(cancel).not.toHaveBeenCalled();
  });

  it("forwards provider and message options to the session canceller", () => {
    const cancel = vi.fn();
    registerSession("a", { projectKey: "/project", cancel });

    cancelSessionsForProject("/project", {
      provider: "gemini",
      message: "config deleted",
      reason: "config_deleted",
    });

    expect(cancel).toHaveBeenCalledWith({
      provider: "gemini",
      message: "config deleted",
      reason: "config_deleted",
    });
  });
});
