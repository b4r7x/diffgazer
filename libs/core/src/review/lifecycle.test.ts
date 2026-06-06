import { describe, expect, it } from "vitest";
import type { StepState } from "../schemas/events/index.js";
import {
  getLoadingMessage,
  isCheckingForChanges,
  isNoDiffError,
} from "./lifecycle.js";

function makeStep(id: string, status: StepState["status"]): StepState {
  return { id, label: id, status } as StepState;
}

describe("isNoDiffError", () => {
  it("matches both staged and unstaged empty-diff messages", () => {
    expect(isNoDiffError("No staged changes found")).toBe(true);
    expect(isNoDiffError("No unstaged changes detected")).toBe(true);
  });

  it("returns false for null, empty, or unrelated errors", () => {
    expect(isNoDiffError(null)).toBe(false);
    expect(isNoDiffError("")).toBe(false);
    expect(isNoDiffError("AI provider down")).toBe(false);
  });
});

describe("isCheckingForChanges", () => {
  it("flags checking while the diff step is pending and streaming", () => {
    expect(
      isCheckingForChanges(true, [makeStep("diff", "pending")]),
    ).toBe(true);
  });

  it("clears checking once the diff step completes", () => {
    expect(
      isCheckingForChanges(true, [makeStep("diff", "completed")]),
    ).toBe(false);
  });

  it("clears checking once the diff step errors", () => {
    expect(
      isCheckingForChanges(true, [makeStep("diff", "error")]),
    ).toBe(false);
  });

  it("never flags checking when streaming is false", () => {
    expect(
      isCheckingForChanges(false, [makeStep("diff", "pending")]),
    ).toBe(false);
  });

  it("still flags checking when the diff step has not yet been registered (treated as pending)", () => {
    expect(
      isCheckingForChanges(true, [makeStep("review", "active")]),
    ).toBe(true);
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
    expect(getLoadingMessage({ ...base, configLoading: true })).toBe(
      "Loading configuration...",
    );
    expect(getLoadingMessage({ ...base, settingsLoading: true })).toBe(
      "Loading configuration...",
    );
  });

  it("returns the diff message when checking for changes or initializing", () => {
    expect(getLoadingMessage({ ...base, isCheckingForChanges: true })).toBe(
      "Checking for changes...",
    );
    expect(getLoadingMessage({ ...base, isInitializing: true })).toBe(
      "Checking for changes...",
    );
  });

  it("returns null when nothing is loading", () => {
    expect(getLoadingMessage(base)).toBeNull();
  });

  it("prefers the configuration message over the changes message", () => {
    expect(
      getLoadingMessage({ ...base, configLoading: true, isCheckingForChanges: true }),
    ).toBe("Loading configuration...");
  });
});
