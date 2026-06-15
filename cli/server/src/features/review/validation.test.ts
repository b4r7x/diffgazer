import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isValidProjectPath, resolvesToSameProject } from "./validation.js";

describe("isValidProjectPath", () => {
  it.each([
    { description: "parent traversal at the start", path: "../etc/passwd" },
    { description: "parent traversal in the middle", path: "foo/../bar" },
    { description: "parent traversal at the end", path: "foo/.." },
    { description: "backslash traversal", path: "foo\\..\\bar" },
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
    { description: "dots embedded in a segment name", path: "src/foo..bar/baz" },
    { description: "empty string", path: "" },
    { description: "root path", path: "/" },
  ])("accepts $description", ({ path }) => {
    expect(isValidProjectPath(path)).toBe(true);
  });
});

describe("resolvesToSameProject", () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "dg-validation-"));
    await mkdir(join(root, "child"), { recursive: true });
    await symlink(root, join(root, "self-link"));
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("accepts the project root itself", async () => {
    expect(await resolvesToSameProject(root, root)).toBe(true);
  });

  it("accepts a symlink that resolves to the same root", async () => {
    expect(await resolvesToSameProject(join(root, "self-link"), root)).toBe(true);
  });

  it("rejects a child directory (must identify the root, not a sub-path)", async () => {
    expect(await resolvesToSameProject(join(root, "child"), root)).toBe(false);
  });

  it("rejects a sibling outside the root", async () => {
    const sibling = await mkdtemp(join(tmpdir(), "dg-validation-other-"));
    try {
      expect(await resolvesToSameProject(sibling, root)).toBe(false);
    } finally {
      await rm(sibling, { recursive: true, force: true });
    }
  });

  it("rejects traversal that escapes the root", async () => {
    expect(await resolvesToSameProject(join(root, "..", ".."), root)).toBe(false);
  });

  it("rejects a null byte", async () => {
    expect(await resolvesToSameProject(`${root}\0`, root)).toBe(false);
  });

  it("rejects a non-existent candidate", async () => {
    expect(await resolvesToSameProject(join(root, "does-not-exist"), root)).toBe(false);
  });
});
