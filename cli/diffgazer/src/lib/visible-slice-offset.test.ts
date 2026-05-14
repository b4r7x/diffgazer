import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { getVisibleSliceOffset } from "./visible-slice-offset.js";

describe("getVisibleSliceOffset", () => {
  test("returns 0 when total fits in the window", () => {
    assert.equal(getVisibleSliceOffset(0, 5, 10), 0);
    assert.equal(getVisibleSliceOffset(4, 5, 10), 0);
  });

  test("returns 0 while the highlight is within the first window", () => {
    assert.equal(getVisibleSliceOffset(0, 20, 10), 0);
    assert.equal(getVisibleSliceOffset(9, 20, 10), 0);
  });

  test("scrolls so the highlight stays on the bottom row", () => {
    assert.equal(getVisibleSliceOffset(10, 20, 10), 1);
    assert.equal(getVisibleSliceOffset(15, 20, 10), 6);
  });

  test("clamps to the maximum offset when reaching the end", () => {
    assert.equal(getVisibleSliceOffset(19, 20, 10), 10);
    assert.equal(getVisibleSliceOffset(100, 20, 10), 10);
  });

  test("handles a window of size 1", () => {
    assert.equal(getVisibleSliceOffset(0, 5, 1), 0);
    assert.equal(getVisibleSliceOffset(3, 5, 1), 3);
    assert.equal(getVisibleSliceOffset(4, 5, 1), 4);
  });
});
