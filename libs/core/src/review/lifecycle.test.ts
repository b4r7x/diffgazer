import { describe, expect, it } from "vitest";
import type { StepState } from "../schemas/events/index.js";
import { ReviewErrorCode } from "../schemas/review/index.js";
import {
  getLoadingMessage,
  isCheckingForChanges,
  isNoDiffError,
  isSessionTerminationCode,
  sessionTerminationCopy,
} from "./lifecycle.js";

function makeStep(id: string, status: StepState["status"]): StepState {
  return { id, label: id, status } as StepState;
}

describe("isNoDiffError", () => {
  it("matches the structured no-diff error code", () => {
    expect(isNoDiffError(ReviewErrorCode.NO_DIFF)).toBe(true);
  });

  it("returns false for null, empty, copy text, or unrelated codes", () => {
    expect(isNoDiffError(null)).toBe(false);
    expect(isNoDiffError("")).toBe(false);
    expect(isNoDiffError("No staged changes found")).toBe(false);
    expect(isNoDiffError(ReviewErrorCode.AI_ERROR)).toBe(false);
  });
});

describe("isCheckingForChanges", () => {
  it("flags checking while the diff step is pending and streaming", () => {
    expect(isCheckingForChanges(true, [makeStep("diff", "pending")])).toBe(true);
  });

  it("clears checking once the diff step completes", () => {
    expect(isCheckingForChanges(true, [makeStep("diff", "completed")])).toBe(false);
  });

  it("clears checking once the diff step errors", () => {
    expect(isCheckingForChanges(true, [makeStep("diff", "error")])).toBe(false);
  });

  it("never flags checking when streaming is false", () => {
    expect(isCheckingForChanges(false, [makeStep("diff", "pending")])).toBe(false);
  });

  it("still flags checking when the diff step has not yet been registered (treated as pending)", () => {
    expect(isCheckingForChanges(true, [makeStep("review", "active")])).toBe(true);
    expect(isCheckingForChanges(true, [])).toBe(true);
  });
});

describe("getLoadingMessage", () => {
  const base = {
    configLoading: false,
    settingsLoading: false,
    isCheckingForChanges: false,
    isInitializing: false,
  };

  it("returns the config message when config or settings are loading", () => {
    expect(getLoadingMessage({ ...base, configLoading: true })).toBe("Loading configuration...");
    expect(getLoadingMessage({ ...base, settingsLoading: true })).toBe("Loading configuration...");
  });

  it("returns the diff message when checking for changes or initializing", () => {
    expect(getLoadingMessage({ ...base, isCheckingForChanges: true })).toBe(
      "Checking for changes...",
    );
    expect(getLoadingMessage({ ...base, isInitializing: true })).toBe("Checking for changes...");
  });

  it("returns null when nothing is loading", () => {
    expect(getLoadingMessage(base)).toBeNull();
  });

  it("prefers the configuration message over the changes message", () => {
    expect(getLoadingMessage({ ...base, configLoading: true, isCheckingForChanges: true })).toBe(
      "Loading configuration...",
    );
  });
});

describe("sessionTerminationCopy", () => {
  it("maps eviction, timeout, shutdown, and stale to four distinct messages", () => {
    const messages = [
      sessionTerminationCopy(ReviewErrorCode.SESSION_EVICTED).message,
      sessionTerminationCopy(ReviewErrorCode.SESSION_TIMEOUT).message,
      sessionTerminationCopy(ReviewErrorCode.SERVER_SHUTDOWN).message,
      sessionTerminationCopy(ReviewErrorCode.SESSION_STALE).message,
    ];
    expect(new Set(messages).size).toBe(4);
  });

  it("does not tell the user to start/retry a review when the server is shutting down", () => {
    const copy = sessionTerminationCopy(ReviewErrorCode.SERVER_SHUTDOWN);
    expect(copy.message).not.toMatch(/start|retry|again/i);
    expect(copy.message).toMatch(/shutting down/i);
  });
});

describe("isSessionTerminationCode", () => {
  it("recognizes the four terminal session causes and rejects unrelated codes", () => {
    expect(isSessionTerminationCode(ReviewErrorCode.SESSION_STALE)).toBe(true);
    expect(isSessionTerminationCode(ReviewErrorCode.SESSION_EVICTED)).toBe(true);
    expect(isSessionTerminationCode(ReviewErrorCode.SESSION_TIMEOUT)).toBe(true);
    expect(isSessionTerminationCode(ReviewErrorCode.SERVER_SHUTDOWN)).toBe(true);
    expect(isSessionTerminationCode(ReviewErrorCode.SESSION_NOT_FOUND)).toBe(false);
    expect(isSessionTerminationCode(ReviewErrorCode.AI_ERROR)).toBe(false);
  });
});
