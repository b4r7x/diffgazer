import { describe, it, expect } from "vitest";
import { normalizeKeyInput } from "./normalize-key-input";

interface TestOptions {
  enabled?: boolean;
}

const noop = () => {};

describe("normalizeKeyInput", () => {
  describe("string key + handler", () => {
    it("returns a single-entry handler map", () => {
      const result = normalizeKeyInput<TestOptions>("Escape", noop);

      expect(result.handlerMap).toEqual({ Escape: noop });
      expect(result.options).toBeUndefined();
    });

    it("passes options as third argument", () => {
      const opts: TestOptions = { enabled: false };
      const result = normalizeKeyInput<TestOptions>("Escape", noop, opts);

      expect(result.handlerMap).toEqual({ Escape: noop });
      expect(result.options).toEqual({ enabled: false });
    });
  });

  describe("array of keys + handler", () => {
    it("maps each key to the same handler", () => {
      const result = normalizeKeyInput<TestOptions>(["Enter", " "], noop);

      expect(result.handlerMap).toEqual({ Enter: noop, " ": noop });
      expect(result.options).toBeUndefined();
    });

    it("passes options as third argument", () => {
      const opts: TestOptions = { enabled: true };
      const result = normalizeKeyInput<TestOptions>(["a", "b"], noop, opts);

      expect(result.handlerMap).toEqual({ a: noop, b: noop });
      expect(result.options).toEqual({ enabled: true });
    });
  });

  describe("key map (record)", () => {
    it("passes through the handler map directly", () => {
      const up = () => {};
      const down = () => {};
      const map = { ArrowUp: up, ArrowDown: down };
      const result = normalizeKeyInput<TestOptions>(map);

      expect(result.handlerMap).toBe(map);
      expect(result.options).toBeUndefined();
    });

    it("treats second argument as options", () => {
      const map = { Escape: noop };
      const opts: TestOptions = { enabled: false };
      const result = normalizeKeyInput<TestOptions>(map, opts);

      expect(result.handlerMap).toBe(map);
      expect(result.options).toEqual({ enabled: false });
    });
  });
});
