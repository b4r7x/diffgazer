import { test, describe, expect } from "vitest";
import { formatIssueLineRange } from "./issue-details-helpers";

describe("formatIssueLineRange", () => {
  test("renders '?' when start is missing", () => {
    expect(formatIssueLineRange(undefined, undefined)).toBe("?");
    expect(formatIssueLineRange(null, 10)).toBe("?");
  });

  test("renders single line when only start is present", () => {
    expect(formatIssueLineRange(7, undefined)).toBe("7");
    expect(formatIssueLineRange(7, null)).toBe("7");
  });

  test("renders range when both endpoints are present", () => {
    expect(formatIssueLineRange(7, 12)).toBe("7-12");
  });

  test("renders same line as start-end when they're equal", () => {
    expect(formatIssueLineRange(7, 7)).toBe("7-7");
  });
});
