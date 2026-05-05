import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  relativePath,
  ensureExists,
  resetDir,
  collectAllFiles,
  collectJsonFiles,
} from "../utils/fs.js";

describe("relativePath", () => {
  it("strips base prefix from file path", () => {
    expect(relativePath("/a/b", "/a/b/c/d.ts")).toBe("c/d.ts");
  });

  it("returns original path when base does not match", () => {
    expect(relativePath("/x/y", "/a/b/c.ts")).toBe("/a/b/c.ts");
  });
});

describe("ensureExists", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-fs-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("does not throw when path exists", () => {
    writeFileSync(join(tempDir, "file.txt"), "content");
    expect(() => ensureExists(join(tempDir, "file.txt"), "test file")).not.toThrow();
  });

  it("throws with label when path does not exist", () => {
    expect(() => ensureExists(join(tempDir, "missing"), "test file")).toThrow(
      "test file not found",
    );
  });
});

describe("resetDir", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-fs-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("clears existing directory and recreates it", () => {
    const dir = join(tempDir, "target");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "old.txt"), "stale");

    resetDir(dir);

    expect(existsSync(dir)).toBe(true);
    expect(existsSync(join(dir, "old.txt"))).toBe(false);
  });

  it("creates directory when it does not exist", () => {
    const dir = join(tempDir, "new-dir");
    resetDir(dir);

    expect(existsSync(dir)).toBe(true);
  });
});

describe("collectAllFiles", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-fs-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("collects files recursively", () => {
    mkdirSync(join(tempDir, "sub"), { recursive: true });
    writeFileSync(join(tempDir, "a.txt"), "a");
    writeFileSync(join(tempDir, "sub", "b.txt"), "b");

    const files = collectAllFiles(tempDir);
    expect(files).toHaveLength(2);
    expect(files.some((f) => f.endsWith("a.txt"))).toBe(true);
    expect(files.some((f) => f.endsWith("b.txt"))).toBe(true);
  });

  it("returns empty array for empty directory", () => {
    const dir = join(tempDir, "empty");
    mkdirSync(dir);
    expect(collectAllFiles(dir)).toEqual([]);
  });
});

describe("collectJsonFiles", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-fs-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("collects only .json files recursively", () => {
    mkdirSync(join(tempDir, "sub"), { recursive: true });
    writeFileSync(join(tempDir, "a.json"), "{}");
    writeFileSync(join(tempDir, "b.txt"), "text");
    writeFileSync(join(tempDir, "sub", "c.json"), "{}");

    const files = collectJsonFiles(tempDir);
    expect(files).toHaveLength(2);
    expect(files.every((f) => f.endsWith(".json"))).toBe(true);
  });
});
