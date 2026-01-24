import { describe, it, expect } from "vitest";
import { safeParseJson } from "./json.js";

describe("safeParseJson", () => {
  const errorFactory = (message: string, details?: string) => ({
    message,
    details,
  });

  it("returns ok with parsed value for valid JSON object", () => {
    const result = safeParseJson('{"name":"Alice","age":30}', errorFactory);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ name: "Alice", age: 30 });
    }
  });

  it("returns ok with parsed value for valid JSON array", () => {
    const result = safeParseJson('[1, 2, 3, "four"]', errorFactory);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([1, 2, 3, "four"]);
    }
  });

  it("returns ok with parsed value for valid JSON primitives", () => {
    const stringResult = safeParseJson('"hello"', errorFactory);
    expect(stringResult.ok).toBe(true);
    if (stringResult.ok) {
      expect(stringResult.value).toBe("hello");
    }

    const numberResult = safeParseJson("42", errorFactory);
    expect(numberResult.ok).toBe(true);
    if (numberResult.ok) {
      expect(numberResult.value).toBe(42);
    }

    const boolResult = safeParseJson("true", errorFactory);
    expect(boolResult.ok).toBe(true);
    if (boolResult.ok) {
      expect(boolResult.value).toBe(true);
    }

    const nullResult = safeParseJson("null", errorFactory);
    expect(nullResult.ok).toBe(true);
    if (nullResult.ok) {
      expect(nullResult.value).toBe(null);
    }
  });

  it("returns err with custom error for invalid JSON", () => {
    const result = safeParseJson("{invalid json}", errorFactory);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Invalid JSON");
    }
  });

  it("passes JSON parse error details to errorFactory", () => {
    const result = safeParseJson("{missing: quotes}", errorFactory);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Invalid JSON");
      expect(result.error.details).toEqual(expect.any(String));
      expect(result.error.details).toContain("JSON");
    }
  });
});
