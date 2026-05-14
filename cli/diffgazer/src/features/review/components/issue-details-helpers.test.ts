import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { formatIssueLineRange } from "./issue-details-helpers.js";

describe("formatIssueLineRange", () => {
  test("renders '?' when start is missing", () => {
    assert.equal(formatIssueLineRange(undefined, undefined), "?");
    assert.equal(formatIssueLineRange(null, 10), "?");
  });

  test("renders single line when only start is present", () => {
    assert.equal(formatIssueLineRange(7, undefined), "7");
    assert.equal(formatIssueLineRange(7, null), "7");
  });

  test("renders range when both endpoints are present", () => {
    assert.equal(formatIssueLineRange(7, 12), "7-12");
  });

  test("renders same line as start-end when they're equal", () => {
    assert.equal(formatIssueLineRange(7, 7), "7-7");
  });
});
