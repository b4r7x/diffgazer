import { describe, it, expect } from "vitest";
import { keys } from "./keys";

const noop = () => {};

describe("keys", () => {
  it("maps each hotkey to the same handler", () => {
    const result = keys(["ArrowUp", "ArrowDown"], noop);

    expect(result).toEqual({ ArrowUp: noop, ArrowDown: noop });
  });

  it("returns an empty object for empty array", () => {
    const result = keys([], noop);

    expect(result).toEqual({});
  });
});
