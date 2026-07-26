import { describe, expect, it } from "vitest";
import { safeParseJson } from "./json.js";

describe("safeParseJson", () => {
  it.each([
    ['{"key": "value"}', { key: "value" }],
    ['```json\n{"a": 1}\n```', { a: 1 }],
    ['```\n{"a": 1}\n```', { a: 1 }],
    ['  \n{"x": 42}\n  ', { x: 42 }],
    ["[1, 2, 3]", [1, 2, 3]],
    ['"hello"', "hello"],
    ['  ```json\n  {"nested": true}\n  ```  ', { nested: true }],
  ])("parses %j", (input, expected) => {
    const result = safeParseJson(input);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(expected);
  });

  it.each(["{not valid}", ""])("returns parse errors for %j", (input) => {
    const result = safeParseJson(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/^Invalid JSON: /);
    }
  });
});
