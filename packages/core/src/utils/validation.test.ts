import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  isValidUuid,
  assertValidUuid,
  validateSchema,
  parseAndValidate,
  isRelativePath,
  isValidProjectPath,
} from "./validation.js";

describe("isValidUuid", () => {
  it("returns true for valid UUID v4", () => {
    expect(isValidUuid("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")).toBe(true);
  });

  it("returns true for valid UUID with uppercase", () => {
    expect(isValidUuid("A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11")).toBe(true);
    expect(isValidUuid("A0eEbC99-9C0b-4Ef8-Bb6D-6bB9Bd380a11")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isValidUuid("")).toBe(false);
  });

  it("returns false for non-UUID string", () => {
    expect(isValidUuid("not-a-uuid")).toBe(false);
  });

  it("returns false for too short UUID", () => {
    expect(isValidUuid("a0eebc99-9c0b-4ef8")).toBe(false);
  });

  it("returns false for wrong format", () => {
    expect(isValidUuid("a0eebc999c0b4ef8bb6d6bb9bd380a11")).toBe(false);
    expect(isValidUuid("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a1")).toBe(false);
    expect(isValidUuid("g0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")).toBe(false);
  });
});

describe("assertValidUuid", () => {
  it("returns UUID when valid", () => {
    const uuid = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    expect(assertValidUuid(uuid)).toBe(uuid);
  });

  it("throws error when invalid", () => {
    expect(() => assertValidUuid("not-a-uuid")).toThrow(
      "Invalid UUID format: not-a-uuid"
    );
  });
});

describe("validateSchema", () => {
  const testSchema = z.object({
    name: z.string(),
    age: z.number(),
  });

  const errorFactory = (message: string) => ({
    code: "VALIDATION_ERROR" as const,
    message,
  });

  it("returns ok Result for valid data", () => {
    const result = validateSchema(
      { name: "Alice", age: 30 },
      testSchema,
      errorFactory
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ name: "Alice", age: 30 });
    }
  });

  it("returns err Result for invalid data with error details", () => {
    const result = validateSchema(
      { name: "Alice", age: "not-a-number" },
      testSchema,
      errorFactory
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("age");
    }
  });

  it("calls custom error factory on validation failure", () => {
    const customErrorFactory = (message: string) => ({
      type: "CUSTOM" as const,
      details: message,
    });

    const result = validateSchema(
      { name: 123, age: 30 },
      testSchema,
      customErrorFactory
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("CUSTOM");
      expect(result.error.details).toContain("name");
    }
  });

  it("returns err Result for missing required fields", () => {
    const result = validateSchema({ name: "Alice" }, testSchema, errorFactory);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("age");
    }
  });
});

describe("parseAndValidate", () => {
  const testSchema = z.object({
    id: z.string(),
    count: z.number(),
  });

  const parseErrorFactory = (message: string) => ({
    code: "PARSE_ERROR" as const,
    message,
  });

  const validationErrorFactory = (message: string) => ({
    code: "VALIDATION_ERROR" as const,
    message,
  });

  it("returns ok Result for valid JSON and valid schema", () => {
    const result = parseAndValidate(
      '{"id": "test", "count": 42}',
      testSchema,
      parseErrorFactory,
      validationErrorFactory
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ id: "test", count: 42 });
    }
  });

  it("returns err Result for invalid JSON with parse error", () => {
    const result = parseAndValidate(
      '{invalid json}',
      testSchema,
      parseErrorFactory,
      validationErrorFactory
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PARSE_ERROR");
    }
  });

  it("returns err Result for valid JSON but invalid schema", () => {
    const result = parseAndValidate(
      '{"id": "test", "count": "not-a-number"}',
      testSchema,
      parseErrorFactory,
      validationErrorFactory
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("count");
    }
  });

  it("returns err Result for empty string", () => {
    const result = parseAndValidate(
      "",
      testSchema,
      parseErrorFactory,
      validationErrorFactory
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PARSE_ERROR");
    }
  });

  it("returns err Result for missing required fields", () => {
    const result = parseAndValidate(
      '{"id": "test"}',
      testSchema,
      parseErrorFactory,
      validationErrorFactory
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("count");
    }
  });
});

describe("isRelativePath", () => {
  it("returns true for simple relative path", () => {
    expect(isRelativePath("foo/bar.ts")).toBe(true);
  });

  it("returns true for dot-slash relative path", () => {
    expect(isRelativePath("./foo/bar.ts")).toBe(true);
  });

  it("returns false for absolute Unix path", () => {
    expect(isRelativePath("/absolute/path")).toBe(false);
  });

  it("returns false for absolute Windows path", () => {
    expect(isRelativePath("C:\\absolute\\path")).toBe(false);
    expect(isRelativePath("C:/absolute/path")).toBe(false);
  });

  it("returns false for parent directory traversal", () => {
    expect(isRelativePath("../parent/path")).toBe(false);
  });

  it("returns false for path traversal in middle", () => {
    expect(isRelativePath("foo/../bar")).toBe(false);
  });

  it("returns false for path with null byte", () => {
    expect(isRelativePath("foo\0bar")).toBe(false);
  });

  it("returns false for Windows backslash absolute path", () => {
    expect(isRelativePath("\\absolute\\path")).toBe(false);
  });

  it("returns true for nested relative path", () => {
    expect(isRelativePath("src/components/Button.tsx")).toBe(true);
  });
});

describe("isValidProjectPath", () => {
  it("returns true for valid project path", () => {
    expect(isValidProjectPath("src/file.ts")).toBe(true);
  });

  it("returns false for path with null byte", () => {
    expect(isValidProjectPath("src\0file.ts")).toBe(false);
  });

  it("returns false for path traversal with parent directory", () => {
    expect(isValidProjectPath("../etc/passwd")).toBe(false);
  });

  it("returns false for path traversal in middle", () => {
    expect(isValidProjectPath("src/../etc/passwd")).toBe(false);
  });

  it("returns true for nested valid path", () => {
    expect(isValidProjectPath("packages/core/src/utils/validation.ts")).toBe(
      true
    );
  });

  it("returns true for path with dots in filename", () => {
    expect(isValidProjectPath("src/file.test.ts")).toBe(true);
  });

  it("returns false for multiple path traversals", () => {
    expect(isValidProjectPath("../../etc/passwd")).toBe(false);
  });
});
