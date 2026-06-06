import { describe, expect, it } from "vitest";
import {
  isMenuActionDisabled,
  isReviewAction,
  isReviewStartAction,
} from "./menu-disabling.js";

describe("isReviewStartAction", () => {
  it("matches the three review-start ids only", () => {
    expect(isReviewStartAction("review-unstaged")).toBe(true);
    expect(isReviewStartAction("review-staged")).toBe(true);
    expect(isReviewStartAction("review-files")).toBe(true);
    expect(isReviewStartAction("resume-review")).toBe(false);
    expect(isReviewStartAction("history")).toBe(false);
    expect(isReviewStartAction("quit")).toBe(false);
  });
});

describe("isReviewAction", () => {
  it("includes resume-review alongside the start actions", () => {
    expect(isReviewAction("review-unstaged")).toBe(true);
    expect(isReviewAction("review-staged")).toBe(true);
    expect(isReviewAction("review-files")).toBe(true);
    expect(isReviewAction("resume-review")).toBe(true);
    expect(isReviewAction("settings")).toBe(false);
  });
});

describe("isMenuActionDisabled", () => {
  it("disables review-start actions when directory is untrusted", () => {
    const ctx = { isTrusted: false, hasResumableSession: true };
    expect(isMenuActionDisabled("review-unstaged", ctx)).toBe(true);
    expect(isMenuActionDisabled("review-staged", ctx)).toBe(true);
    expect(isMenuActionDisabled("review-files", ctx)).toBe(true);
  });

  it("enables review-start actions when trusted", () => {
    const ctx = { isTrusted: true, hasResumableSession: false };
    expect(isMenuActionDisabled("review-unstaged", ctx)).toBe(false);
    expect(isMenuActionDisabled("review-staged", ctx)).toBe(false);
    expect(isMenuActionDisabled("review-files", ctx)).toBe(false);
  });

  it("disables resume-review when there is no resumable session even if trusted", () => {
    expect(
      isMenuActionDisabled("resume-review", { isTrusted: true, hasResumableSession: false })
    ).toBe(true);
  });

  it("enables resume-review when trusted and a resumable session exists", () => {
    expect(
      isMenuActionDisabled("resume-review", { isTrusted: true, hasResumableSession: true })
    ).toBe(false);
  });

  it("disables resume-review when untrusted regardless of resumable session", () => {
    expect(
      isMenuActionDisabled("resume-review", { isTrusted: false, hasResumableSession: true })
    ).toBe(true);
  });

  it("never disables non-review menu actions", () => {
    const ctx = { isTrusted: false, hasResumableSession: false };
    expect(isMenuActionDisabled("history", ctx)).toBe(false);
    expect(isMenuActionDisabled("settings", ctx)).toBe(false);
    expect(isMenuActionDisabled("help", ctx)).toBe(false);
    expect(isMenuActionDisabled("quit", ctx)).toBe(false);
  });
});
