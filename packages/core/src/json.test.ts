import { describe, it, expect } from "vitest";
import { safeParseJson } from "./json.js";

const errorFactory = (message: string, details?: string) => ({
  code: "PARSE_ERROR" as const,
  message,
  details,
});

describe("safeParseJson", () => {
  it("parses valid JSON", () => {
    const result = safeParseJson('{"key": "value"}', errorFactory);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ key: "value" });
  });

  it("strips ```json markdown fences", () => {
    const result = safeParseJson('```json\n{"a": 1}\n```', errorFactory);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ a: 1 });
  });

  it("strips plain ``` markdown fences", () => {
    const result = safeParseJson('```\n{"a": 1}\n```', errorFactory);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ a: 1 });
  });

  it("returns error for invalid JSON", () => {
    const result = safeParseJson("{not valid}", errorFactory);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Invalid JSON");
      expect(result.error.details).toBeDefined();
    }
  });

  it("handles empty string", () => {
    const result = safeParseJson("", errorFactory);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe("Invalid JSON");
  });

  it("handles JSON with surrounding whitespace", () => {
    const result = safeParseJson('  \n{"x": 42}\n  ', errorFactory);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ x: 42 });
  });

  it("parses arrays", () => {
    const result = safeParseJson("[1, 2, 3]", errorFactory);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([1, 2, 3]);
  });

  it("parses primitive JSON values", () => {
    const result = safeParseJson('"hello"', errorFactory);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("hello");
  });

  it("handles content wrapped in ```json fences with whitespace", () => {
    const result = safeParseJson(
      '  ```json\n  {"nested": true}\n  ```  ',
      errorFactory
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ nested: true });
  });
});
