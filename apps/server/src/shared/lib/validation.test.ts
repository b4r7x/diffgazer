import { describe, it, expect } from "vitest";
import { isValidProjectPath } from "./validation.js";

describe("isValidProjectPath", () => {
  it("should reject paths with .. (path traversal)", () => {
    expect(isValidProjectPath("../etc/passwd")).toBe(false);
    expect(isValidProjectPath("foo/../bar")).toBe(false);
    expect(isValidProjectPath("foo/..")).toBe(false);
  });

  it("should reject paths with null bytes", () => {
    expect(isValidProjectPath("foo\0bar")).toBe(false);
    expect(isValidProjectPath("\0")).toBe(false);
  });

  it("should accept normal paths", () => {
    expect(isValidProjectPath("/home/user/project")).toBe(true);
    expect(isValidProjectPath("src/main.ts")).toBe(true);
    expect(isValidProjectPath("packages/core/src/result.ts")).toBe(true);
  });

  it("should accept paths with dots that are not traversal", () => {
    expect(isValidProjectPath("file.ts")).toBe(true);
    expect(isValidProjectPath(".gitignore")).toBe(true);
    expect(isValidProjectPath("src/.env.local")).toBe(true);
  });

  it("should accept empty string", () => {
    expect(isValidProjectPath("")).toBe(true);
  });

  it("should accept root path", () => {
    expect(isValidProjectPath("/")).toBe(true);
  });
});
