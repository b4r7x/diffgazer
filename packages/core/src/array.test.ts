import { describe, it, expect } from "vitest";
import { chunk } from "./array.js";

describe("chunk", () => {
  it("splits array into chunks of specified size", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7];
    expect(chunk(arr, 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });

  it("handles array length divisible by chunk size", () => {
    const arr = [1, 2, 3, 4, 5, 6];
    expect(chunk(arr, 2)).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });

  it("handles chunk size larger than array", () => {
    const arr = [1, 2, 3];
    expect(chunk(arr, 10)).toEqual([[1, 2, 3]]);
  });

  it("handles empty array", () => {
    expect(chunk([], 5)).toEqual([]);
  });

  it("handles chunk size of 1", () => {
    const arr = [1, 2, 3];
    expect(chunk(arr, 1)).toEqual([[1], [2], [3]]);
  });

  it("handles strings in array", () => {
    const arr = ["a", "b", "c", "d", "e"];
    expect(chunk(arr, 2)).toEqual([["a", "b"], ["c", "d"], ["e"]]);
  });
});
