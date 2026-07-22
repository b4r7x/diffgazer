import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelSessionsForProject,
  cancelSessionsForProvider,
  registerSession,
  unregisterSession,
} from "./session-registry.js";

const providerCancelSessionIds = ["project-a", "project-b-gemini", "project-b-openrouter"];

beforeEach(() => {
  unregisterSession("a");
  unregisterSession("b");
  for (const sessionId of providerCancelSessionIds) unregisterSession(sessionId);
});

describe("session-registry", () => {
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

  it("broadcasts the same provider-tagged options to every registered cancel callback", () => {
    const cancelA = vi.fn();
    const cancelB = vi.fn();
    const cancelC = vi.fn();

    registerSession(providerCancelSessionIds[0] ?? "", {
      projectKey: "/project/a",
      cancel: cancelA,
    });
    registerSession(providerCancelSessionIds[1] ?? "", {
      projectKey: "/project/b",
      cancel: cancelB,
    });
    registerSession(providerCancelSessionIds[2] ?? "", {
      projectKey: "/project/b",
      cancel: cancelC,
    });

    cancelSessionsForProvider("gemini", { reason: "provider_deleted" });

    const expected = { provider: "gemini", reason: "provider_deleted" };
    expect(cancelA).toHaveBeenCalledWith(expected);
    expect(cancelB).toHaveBeenCalledWith(expected);
    expect(cancelC).toHaveBeenCalledWith(expected);
  });
});
