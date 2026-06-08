import { describe, expect, test } from "vitest";
import { selectResumableSession } from "./screen.js";

describe("selectResumableSession", () => {
  test("prefers an unstaged active session when both modes are present", () => {
    expect(
      selectResumableSession(
        { reviewId: "unstaged-1", mode: "unstaged" },
        { reviewId: "staged-1", mode: "staged" },
      ),
    ).toEqual({ reviewId: "unstaged-1", mode: "unstaged" });
  });

  test("returns the staged session when it is the only resumable session", () => {
    expect(selectResumableSession(null, { reviewId: "staged-1", mode: "staged" })).toEqual({
      reviewId: "staged-1",
      mode: "staged",
    });
  });

  test("returns null when no resumable session is present", () => {
    expect(selectResumableSession(null, null)).toBeNull();
  });
});
