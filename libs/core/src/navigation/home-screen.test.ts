import { describe, expect, it } from "vitest";
import { resolveHomeMenuActivation, selectResumableSession } from "./home-screen.js";

describe("selectResumableSession", () => {
  it("selects a newer staged session over an older unstaged session", () => {
    expect(
      selectResumableSession(
        {
          reviewId: "rev-unstaged",
          mode: "unstaged",
          startedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          reviewId: "rev-staged",
          mode: "staged",
          startedAt: "2026-01-01T00:01:00.000Z",
        },
      ),
    ).toEqual({ reviewId: "rev-staged", mode: "staged" });
  });

  it("selects a newer unstaged session over an older staged session", () => {
    expect(
      selectResumableSession(
        {
          reviewId: "rev-unstaged",
          mode: "unstaged",
          startedAt: "2026-01-01T00:01:00.000Z",
        },
        {
          reviewId: "rev-staged",
          mode: "staged",
          startedAt: "2026-01-01T00:00:00.000Z",
        },
      ),
    ).toEqual({ reviewId: "rev-unstaged", mode: "unstaged" });
  });

  it("falls back to the staged session when no unstaged session exists", () => {
    expect(selectResumableSession(null, { reviewId: "rev-staged", mode: "staged" })).toEqual({
      reviewId: "rev-staged",
      mode: "staged",
    });
  });

  it("returns null when neither session exists", () => {
    expect(selectResumableSession(null, undefined)).toBeNull();
  });

  it("rejects a session whose mode is not a known review mode", () => {
    expect(
      selectResumableSession(
        { reviewId: "rev-invalid", mode: "bogus", startedAt: "2026-01-01T00:01:00.000Z" },
        { reviewId: "rev-staged", mode: "staged", startedAt: "2026-01-01T00:00:00.000Z" },
      ),
    ).toEqual({ reviewId: "rev-staged", mode: "staged" });
  });
});

describe("resolveHomeMenuActivation", () => {
  const trusted = { isTrusted: true, hasResumableSession: true };

  it("starts a review with the matching mode when trusted", () => {
    expect(resolveHomeMenuActivation("review-unstaged", trusted)).toEqual({
      kind: "start-review",
      mode: "unstaged",
    });
    expect(resolveHomeMenuActivation("review-staged", trusted)).toEqual({
      kind: "start-review",
      mode: "staged",
    });
  });

  it("blocks a review start when untrusted", () => {
    expect(
      resolveHomeMenuActivation("review-unstaged", {
        isTrusted: false,
        hasResumableSession: true,
      }),
    ).toEqual({ kind: "blocked-untrusted" });
  });

  it("resumes when trusted with a resumable session", () => {
    expect(resolveHomeMenuActivation("resume-review", trusted)).toEqual({ kind: "resume" });
  });

  it("no-ops resume when there is no resumable session", () => {
    expect(
      resolveHomeMenuActivation("resume-review", { isTrusted: true, hasResumableSession: false }),
    ).toEqual({ kind: "noop" });
  });

  it("no-ops resume when untrusted", () => {
    expect(
      resolveHomeMenuActivation("resume-review", {
        isTrusted: false,
        hasResumableSession: true,
      }),
    ).toEqual({ kind: "noop" });
  });

  it("navigates to history, settings, and help when untrusted", () => {
    const untrusted = { isTrusted: false, hasResumableSession: true };
    expect(resolveHomeMenuActivation("history", untrusted)).toEqual({
      kind: "navigate",
      target: "history",
    });
    expect(resolveHomeMenuActivation("settings", untrusted)).toEqual({
      kind: "navigate",
      target: "settings",
    });
    expect(resolveHomeMenuActivation("help", untrusted)).toEqual({
      kind: "navigate",
      target: "help",
    });
  });

  it("navigates to history, settings, and help", () => {
    expect(resolveHomeMenuActivation("history", trusted)).toEqual({
      kind: "navigate",
      target: "history",
    });
    expect(resolveHomeMenuActivation("settings", trusted)).toEqual({
      kind: "navigate",
      target: "settings",
    });
    expect(resolveHomeMenuActivation("help", trusted)).toEqual({
      kind: "navigate",
      target: "help",
    });
  });

  it("quits on the quit action", () => {
    expect(resolveHomeMenuActivation("quit", trusted)).toEqual({ kind: "quit" });
  });
});
