import { describe, it, expect } from "vitest";
import { isValidProjectPath } from "./validation.js";

describe("isValidProjectPath", () => {
  it.each([
    { description: "parent traversal at the start", path: "../etc/passwd" },
    { description: "parent traversal in the middle", path: "foo/../bar" },
    { description: "parent traversal at the end", path: "foo/.." },
    { description: "embedded null byte", path: "foo\0bar" },
    { description: "bare null byte", path: "\0" },
  ])("rejects $description", ({ path }) => {
    expect(isValidProjectPath(path)).toBe(false);
  });

  it.each([
    { description: "absolute project path", path: "/home/user/project" },
    { description: "relative source file", path: "src/main.ts" },
    { description: "deep monorepo path", path: "packages/core/src/result.ts" },
    { description: "file with extension", path: "file.ts" },
    { description: "leading-dot config file", path: ".gitignore" },
    { description: "leading-dot in nested path", path: "src/.env.local" },
    { description: "empty string", path: "" },
    { description: "root path", path: "/" },
  ])("accepts $description", ({ path }) => {
    expect(isValidProjectPath(path)).toBe(true);
  });
});
